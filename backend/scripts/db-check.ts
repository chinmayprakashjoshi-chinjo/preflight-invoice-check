import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRealError() {
  console.log("🔍 Checking connection to 'clients' table...");
  const { data, error, status } = await supabase.from('clients').select('*');

  if (error) {
    console.log("❌ FULL ERROR OBJECT:", error);
    console.log("HTTP Status Code:", status);
  } else {
    console.log(`✅ SUCCESS! Clients table has ${data.length} rows.`);
  }
}

checkRealError();