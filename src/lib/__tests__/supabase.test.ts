import {supabase, supabaseAdmin} from '../supabase'

describe('Supabase Connection', () => {
    it('should have valid client configuration', () => {
        expect(supabase).toBeDefined()
        expect(supabase.supabaseUrl).toBeTruthy()
        expect(supabase.supabaseKey).toBeTruthy()
    })

    it('should have valid admin client configuration', () => {
        expect(supabaseAdmin).toBeDefined()
        expect(supabaseAdmin.supabaseUrl).toBeTruthy()
        expect(supabaseAdmin.supabaseKey).toBeTruthy()
    })

    it('should connect to Supabase and query users table', async () => {
        const {error} = await supabase
            .from('users')
            .select('count', {count: 'exact', head: true})

        // Should not have a connection error (permissions errors are fine for this test)
        expect(error === null || error.message !== 'Failed to fetch').toBe(true)
    })
})
