# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Path Finder is a Next.js route planning application that analyzes cycling/running routes from Strava to help users choose diverse paths and explore new areas. The app visualizes route coverage using geographical grid-based heatmaps and calculates overlap scores to maximize spatial diversity.

## Development Commands

```bash
# Development with Turbo
npm run dev

# Build for production  
npm run build

# Start production server
npm start

# Lint the codebase
npm run lint
```

## Architecture Overview

### Core Data Flow
- **Strava Integration**: Uses OAuth2 to fetch activities and routes via `/api/auth/[...nextauth]/route.ts`
- **Route Storage**: GPX files stored in `recent/` (last 2 weeks of activities) and `saved/` (user-created routes) directories
- **Heatmap Analysis**: Grid-based spatial analysis to identify route density and find underexplored areas
- **Overlap Scoring**: Calculates how much saved routes overlap with recent activity patterns

### Key Architecture Components

**Frontend State Management**: 
- React Query for server state and caching (`src/hooks/useRoutes.ts`, `src/hooks/useHeatmapAnalysis.ts`)
- NextAuth for authentication state
- Local state for map interactions and filters

**Spatial Analysis System**:
- `HeatmapTracker` (`src/lib/heatmapTracker.ts`): Grid-based geographical coordinate system
- `routeProcessor.ts`: Accumulates route distances into grid cells
- `heatmapConfig.ts`: Configurable grid size and reference points

**API Routes**:
- `/api/routes`: Serves route data with filtering and heatmap analysis
- `/api/heatmap-analysis`: Provides density analysis for route planning
- `/api/sync-routes`: Syncs latest activities from Strava

**Map Visualization**:
- React-Leaflet with OpenStreetMap tiles
- Density heatmap overlay using colored rectangles
- Dynamic route polylines with configurable styling

### Data Processing Pipeline

1. **Route Loading**: GPX files parsed into coordinate arrays with elevation data
2. **Heatmap Processing**: Routes divided into segments, distances accumulated in grid cells
3. **Overlap Analysis**: Compare individual route coverage against general activity patterns
4. **Filtering**: Distance, elevation, and density-based route filtering

### Component Structure

- `src/app/page.tsx`: Main application with three-column layout (sidebar, route list, map)
- `src/components/Map.tsx`: Interactive map with heatmap visualization controls
- `src/components/RouteCard.tsx`: Route display with metrics and overlap scoring
- `src/components/RouteFilters.tsx`: Filter controls for route selection

## Development Notes

### Map Integration
- Uses dynamic imports to avoid SSR issues with Leaflet
- Heatmap grid overlays with configurable cell sizes (0.5-20km)
- Two modes: general heatmap vs per-route analysis

### Performance Considerations
- React Query caching prevents redundant API calls
- Debounced filter inputs to reduce server load
- Grid-based heatmap system scales to large route datasets

### Authentication Flow
- First login triggers automatic route sync from Strava
- OAuth tokens stored in NextAuth session
- API routes protected by session validation