import { kv } from '@vercel/kv';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;

export default async function handler(req, res) {
    const token = req.headers.authorization?.split(' ')[1];
    let decoded;

    if (token) {
        try {
            decoded = jwt.verify(token, SECRET);
        } catch (e) {
            return res.status(401).json({ error: 'Invalid token' });
        }
    }

    // --- GET Requests ---
    if (req.method === 'GET') {
        const { name } = req.query;

        // GET: Fetch a single public user profile by name
        if (name) {
            const userEmail = await kv.get(`name:${name.toLowerCase()}`);
            if (!userEmail) return res.status(404).json({ error: 'User not found' });
            
            const user = await kv.get(`user:${userEmail}`);
            if (!user) return res.status(404).json({ error: 'User data not found' });

            const { password, email, ...publicData } = user;
            return res.status(200).json(publicData);
        }
        
        // GET: Default - fetch the logged-in user's full profile
        if (!decoded) return res.status(401).json({ error: 'Authentication required' });
        const user = await kv.get(`user:${decoded.email}`);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        const { password, ...userData } = user;
        return res.status(200).json(userData);
    }
    
    // --- PUT Request (Update User) ---
    if (req.method === 'PUT') {
        if (!decoded) return res.status(401).json({ error: 'Authentication required' });
        
        const user = await kv.get(`user:${decoded.email}`);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const { name, ...updateData } = req.body;

        if (name && name.toLowerCase() !== user.name.toLowerCase()) {
            return res.status(400).json({ error: 'Username change is not allowed via this method.' });
        }
        
        const updatedUser = { ...user, ...updateData };
        await kv.set(`user:${user.email}`, updatedUser);
        
        const { password, ...returnData } = updatedUser;
        return res.status(200).json(returnData);
    }

    // --- POST Requests (Actions) ---
    if (req.method === 'POST') {
        const { action, userNames, badge } = req.body;

        if (action === 'getStatuses') {
            if (!userNames || !Array.isArray(userNames)) return res.status(400).json({ error: 'Usernames array is required' });
            const statuses = {};
            for (const name of userNames) {
                const userEmail = await kv.get(`name:${name.toLowerCase()}`);
                 if(userEmail) {
                    const user = await kv.get(`user:${userEmail}`);
                    statuses[name] = user?.lastSeen || null;
                } else {
                    statuses[name] = null;
                }
            }
            return res.status(200).json(statuses);
        }
        
        if (!decoded) return res.status(401).json({ error: 'Authentication required for this action' });
        const user = await kv.get(`user:${decoded.email}`);
        if (!user) return res.status(404).json({ error: 'User not found' });

        if (action === 'updateBadge') {
            user.badges = user.badges.filter(b => !['discoverer', 'collector', 'explorer'].includes(b));
            user.badges.push(badge);
            await kv.set(`user:${user.email}`, user);
            const { password, ...returnData } = user;
            return res.status(200).json(returnData);
        }

        // --- PREMIUM PLAN ACTIONS ---

        if (action === 'create_checkout_session') {
            // In a real application, you would create a Stripe/PayPal session here
            // and return the checkout URL.
            // For this simulation, we just return the URL to our success page.
            const checkoutUrl = '/success.html';
            return res.status(200).json({ url: checkoutUrl });
        }

        if (action === 'confirm_premium_status') {
            if (!user.badges.includes('supporter')) {
                user.badges.push('supporter');
            }
            user.plan = 'premium'; // Add a plan field for future reference
            await kv.set(`user:${user.email}`, user);
            const { password, ...returnData } = user;
            return res.status(200).json(returnData);
        }


        return res.status(400).json({ error: 'Invalid action' });
    }

    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
}