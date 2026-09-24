import type { Feature, MultiPolygon } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import landTopology from 'world-atlas/land-110m.json';

const topology = landTopology as unknown as Topology<{ land: GeometryCollection }>;

/** World land outline (1:110m), shared by the globe and the route map. */
export const LAND = feature(topology, topology.objects.land) as unknown as Feature<MultiPolygon>;
