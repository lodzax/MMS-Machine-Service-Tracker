import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let db: any;

try {
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  console.log("Firebase Config loaded:", JSON.stringify(firebaseConfig, null, 2));
  
  // Initialize with project ID and explicit ADC
  if (admin.apps.length === 0) {
    admin.initializeApp({ 
      projectId: firebaseConfig.projectId,
      credential: admin.credential.applicationDefault()
    });
  }

  const dbId = firebaseConfig.firestoreDatabaseId || '(default)';
  console.log(`Initializing Firestore with Project: ${firebaseConfig.projectId}, Database: ${dbId}`);
  db = admin.firestore(dbId);
  
  // Test connection
  db.collection('machinery').limit(1).get()
    .then(() => console.log("Firestore connection test successful."))
    .catch((err: any) => console.error("Firestore connection test failed:", err.message));
  
  console.log(`Firebase Admin initialized successfully.`);
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error);
}

async function startServer() {
  console.log("Starting server...");
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  console.log("Express app initialized.");

  // API Route to manually trigger the check (for testing)
  app.post("/api/admin/check-service-due", async (req, res) => {
    if (!db) {
      return res.status(500).json({ success: false, error: "Firebase not initialized" });
    }
    try {
      const results = await checkAndNotifyServiceDue();
      res.json({ success: true, processed: results.length, details: results });
    } catch (error) {
      console.error("Error manual trigger:", error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  // API Route to get admin configuration
  app.get("/api/admin/config", (req, res) => {
    res.json({ 
      emailMode: process.env.EMAIL_MODE || 'MOCK'
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Initializing Vite dev server...");
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite middleware attached.");
    } catch (error) {
      console.error("Failed to initialize Vite dev server:", error);
      throw error;
    }
  } else {
    console.log("Running in production mode.");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    if (db) {
      // Test Firestore connection
      try {
        console.log("Testing Firestore connection...");
        const testSnap = await db.collection('machinery').limit(1).get();
        console.log("Firestore connection test successful. Collections accessible.");
      } catch (error) {
        console.error("Firestore connection test failed:", error);
      }

      // Start the background job
      // Check every 24 hours
      setInterval(() => {
        checkAndNotifyServiceDue().catch(err => console.error("Interval background job failed:", err));
      }, 24 * 60 * 60 * 1000);
      
      // Also run once on startup (optional, but good for demo)
      setTimeout(() => {
        checkAndNotifyServiceDue().catch(err => console.error("Initial background job failed:", err));
      }, 5000);
    }
  });
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string;
    providerInfo?: any[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      // For Admin SDK, we don't have a current user in the same way as Client SDK
      userId: "ADMIN_SDK",
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo, null, 2));
  // We don't throw here to prevent crashing the background job, but we log it clearly
}

async function checkAndNotifyServiceDue() {
  if (!db) return [];
  console.log("Running background job: Checking for machinery nearing service due date...");
  
  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(now.getDate() + 7);
  
  const todayStr = now.toISOString().split('T')[0];
  const nextWeekStr = sevenDaysFromNow.toISOString().split('T')[0];

  try {
    console.log(`Querying machinery in database: ${db._databaseId || 'default'}`);
    // Query machinery where nextServiceDueDate is between today and next week
    let machinerySnap;
    try {
      machinerySnap = await db.collection('machinery')
        .where('nextServiceDueDate', '>=', todayStr)
        .where('nextServiceDueDate', '<=', nextWeekStr)
        .get();
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'machinery');
      return [];
    }

    console.log(`Query successful. Found ${machinerySnap.size} machines.`);

    if (machinerySnap.empty) {
      console.log("No machinery nearing service due date.");
      return [];
    }

    const results = [];
    for (const doc of machinerySnap.docs) {
      const machine = doc.data();
      const customerId = machine.customerId;
      
      // Get customer details
      let customerDoc;
      try {
        customerDoc = await db.collection('customers').doc(customerId).get();
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `customers/${customerId}`);
        continue;
      }

      if (!customerDoc.exists) continue;
      
      const customer = customerDoc.data();
      results.push({ machineId: doc.id, customerName: customer.name, dueDate: machine.nextServiceDueDate });
    }
    
    return results;
  } catch (error) {
    console.error("Unexpected error in background job:", error);
    return [];
  }
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
