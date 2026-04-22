import { z } from "zod";

export const NodeTypeSchema = z.enum([
  "endpoint",
  "joint",
  "turnout_left",
  "turnout_right",
  "turnout_wye",
  "crossing",
]);
export type NodeType = z.infer<typeof NodeTypeSchema>;

export const TurnoutStateSchema = z.enum(["normal", "diverging"]);
export type TurnoutState = z.infer<typeof TurnoutStateSchema>;

export const TrackNodeSchema = z.object({
  id: z.string(),
  type: NodeTypeSchema,
  x: z.number(),
  y: z.number(),
  rotation: z.number().default(0),
  label: z.string().optional(),
  state: TurnoutStateSchema.optional(),
});
export type TrackNode = z.infer<typeof TrackNodeSchema>;

export const TrackEdgeSchema = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  blockId: z.string(),
  length: z.number().default(0),
  branch: z.enum(["main", "diverging"]).default("main"),
  curve: z.number().default(0),
});
export type TrackEdge = z.infer<typeof TrackEdgeSchema>;

export const BlockSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  occupied: z.boolean().default(false),
  reservedBy: z.string().nullable().default(null),
});
export type Block = z.infer<typeof BlockSchema>;

export const TrainSchema = z.object({
  id: z.string(),
  road: z.string(),
  number: z.string(),
  color: z.string(),
  length: z.number().default(3),
  position: z
    .object({
      edgeId: z.string(),
      offset: z.number(),
      direction: z.enum(["forward", "reverse"]),
    })
    .nullable()
    .default(null),
  velocity: z.number().default(0),
  maxVelocity: z.number().default(80),
  route: z.array(z.string()).default([]),
  routeIndex: z.number().default(0),
  waiting: z.boolean().default(false),
  paused: z.boolean().default(false),
});
export type Train = z.infer<typeof TrainSchema>;

export const ZoneLabelSchema = z.object({
  id: z.string(),
  text: z.string(),
  x: z.number(),
  y: z.number(),
  size: z.number().default(40),
  opacity: z.number().default(0.25),
});
export type ZoneLabel = z.infer<typeof ZoneLabelSchema>;

export const LayoutSchema = z.object({
  id: z.string(),
  name: z.string(),
  nodes: z.array(TrackNodeSchema),
  edges: z.array(TrackEdgeSchema),
  blocks: z.array(BlockSchema),
  trains: z.array(TrainSchema),
  labels: z.array(ZoneLabelSchema).default([]),
  updatedAt: z.string(),
});
export type Layout = z.infer<typeof LayoutSchema>;
