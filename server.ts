import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase Client for Server-side
// Use Service Role Key if available to bypass RLS for background jobs
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl) {
  console.error("CRITICAL: SUPABASE_URL is missing from environment variables.");
}

// Prefer service key for server-side operations to bypass RLS
const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);

async function startServer() {
  console.log("Starting server...");
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());
  console.log("Express app initialized.");

  // API Route to manually trigger the check (for testing)
  app.post("/api/admin/check-service-due", async (req, res) => {
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
    
  // Test Supabase connection
  try {
    console.log("Testing Supabase connection...");
    console.log("Supabase URL:", supabaseUrl ? `${supabaseUrl.substring(0, 15)}...` : "MISSING");
    console.log("Supabase Service Key present:", !!supabaseServiceKey);
    console.log("Supabase Anon Key present:", !!supabaseAnonKey);
    
    if (!supabaseUrl || (!supabaseServiceKey && !supabaseAnonKey)) {
      console.error("Supabase configuration is incomplete. Background jobs will fail.");
    } else {
      const { data, error } = await supabase.from('machinery').select('id').limit(1);
      if (error) {
        console.error("Supabase connection test failed!");
        console.error("Error Code:", error.code);
        console.error("Error Message:", error.message);
        console.error("Error Details:", error.details);
        console.error("Full Error Object:", JSON.stringify(error, null, 2));
      } else {
        console.log("Supabase connection test successful. Tables accessible.");
      }
    }
  } catch (error) {
    console.error("Supabase connection test threw exception:", error);
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
  });
}

async function checkAndNotifyServiceDue() {
  console.log("Running background job: Checking for machinery nearing service due date...");
  
  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(now.getDate() + 7);
  
  const todayStr = now.toISOString().split('T')[0];
  const nextWeekStr = sevenDaysFromNow.toISOString().split('T')[0];

  try {
    // Query machinery where next_service_due_date is between today and next week
    const { data: machinery, error: machineError } = await supabase
      .from('machinery')
      .select('id, customer_id, next_service_due_date, model')
      .gte('next_service_due_date', todayStr)
      .lte('next_service_due_date', nextWeekStr);

    if (machineError) {
      console.error("Supabase Error [LIST] on table [machinery]!");
      console.error("Error Code:", machineError.code);
      console.error("Error Message:", machineError.message);
      console.error("Error Details:", machineError.details);
      console.error("Full Error Object:", JSON.stringify(machineError, null, 2));
      return [];
    }

    console.log(`Query successful. Found ${machinery?.length || 0} machines.`);

    if (!machinery || machinery.length === 0) {
      console.log("No machinery nearing service due date.");
      return [];
    }

    const results = [];
    for (const machine of machinery) {
      const customerId = machine.customer_id;
      
      // Get customer details
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('name')
        .eq('id', customerId)
        .single();

      if (customerError) {
        console.error(`Supabase Error [GET] on table [customers] for id [${customerId}]:`, JSON.stringify(customerError, null, 2));
        continue;
      }

      if (!customer) continue;
      
      results.push({ 
        machineId: machine.id, 
        customerName: customer.name, 
        dueDate: machine.next_service_due_date,
        model: machine.model
      });
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
