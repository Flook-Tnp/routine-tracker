import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import dotenv from 'dotenv'

const envConfig = dotenv.parse(fs.readFileSync('.env'))
const supabaseUrl = envConfig.VITE_SUPABASE_URL
const supabaseAnonKey = envConfig.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  console.log('Target Category: Practice Language')
  
  // First, find the IDs of routines in this category
  const { data: routines, error: fetchError } = await supabase
    .from('routines')
    .select('id, title')
    .eq('category', 'Practice Language')

  if (fetchError) {
    console.error('Error fetching routines:', fetchError)
    return
  }

  if (!routines || routines.length === 0) {
    console.log('No routines found for category: Practice Language')
    return
  }

  console.log(`Found ${routines.length} routines to delete.`)

  // Delete the routines. Due to ON DELETE CASCADE, completions will be deleted automatically.
  const { error: deleteError } = await supabase
    .from('routines')
    .delete()
    .eq('category', 'Practice Language')

  if (deleteError) {
    console.error('Error deleting routines:', deleteError)
  } else {
    console.log('Successfully deleted routines and their history for "Practice Language".')
  }
}

run()
