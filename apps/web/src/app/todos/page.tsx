import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: todos } = await supabase.from('todos').select()

  return (
    <div style={{ padding: '2rem', color: '#fff', backgroundColor: '#121212', minHeight: '100vh' }}>
      <h1 style={{ color: '#F7D108', marginBottom: '1.5rem' }}>Todos (Supabase SSR Test)</h1>
      <ul style={{ listStyle: 'circle', paddingLeft: '1.5rem' }}>
        {todos?.map((todo) => (
          <li key={todo.id} style={{ margin: '0.5rem 0' }}>{todo.name}</li>
        ))}
      </ul>
      {(!todos || todos.length === 0) && <p style={{ color: '#888' }}>No todos found. Make sure you have a &apos;todos&apos; table in Supabase with a &apos;name&apos; column!</p>}
    </div>
  )
}
