Redesign the Blueprint Designs UI (rename to Markyn) using our existing 
Tailwind/shadcn setup. Reference screenshot attached for direction.

Design tokens:
- Primary action color: near-black/white pair (bg-zinc-900 dark:bg-zinc-50, 
  text inverted) — NOT blue fill
- Secondary buttons: outline/ghost variant only (border-zinc-700, 
  text-zinc-300, no fill)
- Reserve accent blue for exactly ONE primary CTA per screen — currently 
  every toolbar button competes for attention, fix this
- Border radius: rounded-lg on buttons/cards, softer than current sharp edges
- Borders: low-contrast (border-zinc-800 in dark mode), not hard dividers

Specific changes:
1. Logo: replace "BD" square with a pencil/drafting icon (lucide-react 
   has `PenTool` or `Pencil`) in a dark rounded-square container
2. Toolbar: only "New blueprint" gets the filled/primary style. 
   Save Project, Import Project, Save to Cloud all become outline/ghost 
   buttons of equal visual weight
3. Tabs: replace bottom-border active state with a filled pill/rounded 
   background on the active tab (bg-zinc-800 or similar), remove the 
   hard underline
4. Empty state (Blueprint View, no file loaded): add a subtle repeating 
   grid-line background pattern behind the empty state to suggest a 
   drafting surface. Change copy from "No Blueprint Loaded" / "Upload a 
   PDF blueprint to get started" to "Start your first blueprint" / 
   "Upload a PDF to set scale, trace rooms, and price the job as you go."
   Wrap the upload icon in a small bordered card instead of floating bare.
5. Add Google sign-in button next to existing Sign In — use an actual 
   multicolor Google "G" logo SVG (not a generic icon), styled as an 
   outline button, standard placement top-right

   ## Google Sign-In (Web only, via Supabase)

### 1. Google Cloud Console
- [ ] Create OAuth 2.0 credentials (Client ID + Secret)
- [ ] Set OAuth consent screen app name to "Markyn"
- [ ] Add Supabase's callback URL as authorized redirect URI (copy exact URL from Supabase dashboard)
- [ ] If consent screen is in "Testing" mode, add your own email as a test user

### 2. Supabase dashboard
- [ ] Authentication → Providers → enable Google, paste in Client ID + Secret
- [ ] Confirm redirect URLs list includes your Vercel domain

### 3. Frontend implementation
- [ ] Wire `supabase.auth.signInWithOAuth({ provider: 'google' })` to the Sign In button
- [ ] Handle returned session in auth state/context (same pattern as existing email/password flow)
- [ ] Test on deployed Vercel URL, not just localhost
### 4. Don't forget
- [ ] Update Google consent screen name to Markyn before testing — it'll still show old app name otherwise

and then i guess we need to update th ename from blueprin designs eveywhere fdont forget