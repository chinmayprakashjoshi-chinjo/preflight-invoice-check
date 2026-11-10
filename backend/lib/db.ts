import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://psgcpwxsdshxvegngnqw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzZ2Nwd3hzZHNoeHZlZ25nbnF3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NDMyMDM4NCwiZXhwIjoyMTA5ODk2Mzg0fQ.ysBinPvs1cVUytcZU6iE_hvtzIGMOpbOHgs3erfLWH8';

export const db = createClient(supabaseUrl, supabaseKey);