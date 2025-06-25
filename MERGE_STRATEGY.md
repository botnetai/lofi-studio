# Merge Strategy: lofi-studio into lofi-web

## Overview
Merging the professional studio feature (lofi-music/lofi-studio) into the main consumer app (lofi-web).

## Current Architecture Analysis

### lofi-web (Main App)
- **UI Framework**: Radix UI (comprehensive component library)
- **Routing**: React Router v6
- **Authentication**: Clerk
- **State Management**: React Query
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Main Features**: Image remix, Gallery, Music player

### lofi-studio (Studio Feature)
- **UI Framework**: Base UI (recently migrated)
- **Routing**: None (standalone app)
- **Authentication**: None
- **Backend**: Cloudflare Workers (D1, R2, AI)
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Main Features**: Music generation, Video generation, Artwork generation, Album compilation

## Key Decisions Needed

### 1. UI Component Library
**Options:**
- A) Keep Radix UI (lofi-web) and convert studio components
- B) Migrate everything to Base UI
- C) Use both temporarily during transition

**Recommendation**: Option A - Keep Radix UI
- Radix UI is more mature and comprehensive
- lofi-web already has a complete component library
- Less work to convert studio components than entire app

### 2. Backend Integration
**Current State:**
- lofi-studio: Cloudflare Workers with dedicated endpoints
- lofi-web: Backend unclear (need to investigate)

**Recommendation**: 
- Keep studio's Cloudflare Workers as a separate service
- Update API endpoints to work with lofi-web's auth

### 3. Route Structure
**Proposed Routes:**
```
/                     - Main app (current ImageRemixPage)
/studio               - Studio dashboard
/studio/music         - Music generation
/studio/artwork       - Artwork generation  
/studio/compile       - Album compilation
/studio/publish       - Publishing features
```

## Migration Steps

### Phase 1: Preparation
1. Create feature branch for merge
2. Audit lofi-web's backend/API structure
3. Document all studio API endpoints
4. Create compatibility layer for UI components

### Phase 2: Component Migration
1. Convert studio components from Base UI to Radix UI
2. Integrate studio styles with existing theme
3. Add studio navigation to main sidebar
4. Ensure responsive design works

### Phase 3: Backend Integration
1. Add authentication to studio API endpoints
2. Update CORS and security headers
3. Test API integration with Clerk auth
4. Migrate any necessary data schemas

### Phase 4: Feature Integration
1. Add studio route to React Router
2. Integrate studio state with React Query
3. Add studio permissions/subscription checks
4. Test all studio features in new environment

### Phase 5: Testing & Polish
1. Full E2E testing of studio features
2. Performance optimization
3. Mobile responsiveness check
4. Update documentation

## File Structure After Merge
```
lofi-web/
├── src/
│   ├── pages/
│   │   ├── studio/
│   │   │   ├── StudioLayout.tsx
│   │   │   ├── MusicGeneration.tsx
│   │   │   ├── ArtworkGeneration.tsx
│   │   │   ├── CompileAlbum.tsx
│   │   │   └── PublishMusic.tsx
│   ├── components/
│   │   ├── studio/
│   │   │   ├── GenerateMusic.tsx
│   │   │   ├── MusicLibrary.tsx
│   │   │   ├── ArtworkTab.tsx
│   │   │   └── CompileTab.tsx
│   ├── services/
│   │   ├── studio/
│   │   │   ├── musicService.ts
│   │   │   ├── artworkService.ts
│   │   │   └── videoService.ts
```

## Risks & Mitigations

### Risk 1: UI Inconsistency
**Mitigation**: Create design tokens mapping between Base UI and Radix UI styles

### Risk 2: API Authentication Conflicts
**Mitigation**: Implement middleware to handle Clerk tokens in Cloudflare Workers

### Risk 3: Bundle Size Increase
**Mitigation**: Implement code splitting for studio features

### Risk 4: Performance Impact
**Mitigation**: Lazy load studio routes and components

## Success Criteria
- [ ] All studio features work in lofi-web
- [ ] Consistent UI/UX across app
- [ ] No performance degradation
- [ ] Authentication properly integrated
- [ ] Mobile responsive
- [ ] All tests passing