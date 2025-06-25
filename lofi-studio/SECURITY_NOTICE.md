# Security Notice

## Exposed API Keys Removed

On June 25th, 2025, GitGuardian detected exposed API keys in this repository. These have been removed in commit 803e39bd.

### Affected Keys
- GOAPI_KEY
- UDIOAPI_KEY
- FAL_KEY
- JSON2VIDEO_KEY

### Actions Taken
1. All hardcoded API keys have been removed from the codebase
2. Test files now require environment variables instead of hardcoded keys
3. Created .gitignore to prevent future secret leaks
4. Added example configuration files for proper setup

### Required Actions
1. **IMMEDIATELY ROTATE ALL EXPOSED KEYS** through their respective platforms:
   - GoAPI: Generate new key at your provider's dashboard
   - UdioAPI: Regenerate key at udioapi.pro
   - Fal.ai: Create new API key at fal.ai dashboard
   - Json2Video: Obtain new key from provider

2. **Set new keys as Cloudflare secrets**:
   ```bash
   wrangler secret put GOAPI_KEY
   wrangler secret put UDIOAPI_KEY
   wrangler secret put FAL_KEY
   wrangler secret put JSON2VIDEO_KEY
   ```

3. **For local development**, create a `.env` file based on `.env.example`

### Prevention
- Never commit API keys to version control
- Always use environment variables or secret management
- Review commits before pushing to ensure no secrets are included
- Use tools like GitGuardian or git-secrets for pre-commit hooks