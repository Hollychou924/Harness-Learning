export { EVIDENCE_SCHEMA_VERSION, HARNESS_VERSION, emptySignals } from './types.js'
export type {
  TaskEvidence,
  EvidenceSignals,
  VerifierVerdict,
  VerifierScore,
  FailureCase,
  GapPattern,
  Tactic,
  ReflectionDecision,
  TaskFamily,
  AttributionCategory,
  MemoryScope
} from './types.js'
export { EvidenceRecorder, evidenceArtifactPath } from './evidence.js'
export { scoreEvidence } from './verifier.js'
export { ReflectionGovernor } from './reflection-governor.js'
export {
  shouldShortFail,
  peekVerdict,
  buildShortFailNudge,
  SHORT_FAIL_MAX_ROUNDS
} from './short-fail-loop.js'
export { LoopGuard } from './loop-guard.js'
export type { LoopGuardVerdict } from './loop-guard.js'
export {
  classifyAttribution,
  buildFailureCaseFromEvidence,
  attributionLabel,
  ATTRIBUTION_INJECT_WEIGHT
} from './attribution.js'
export {
  recordOutcomeFeedback,
  readExperienceLedger,
  listOutcomeFeedback,
  routeLearningTarget,
  listLearningCandidates
} from './feedback.js'
export type {
  OutcomeKind,
  OutcomeFeedbackInput,
  OutcomeFeedbackRecord,
  RecordOutcomeResult,
  LearningTarget,
  LearningRoute
} from './feedback.js'
export {
  buildGoalContract,
  formatGoalContractBlock,
  evaluateStopGate,
  GOAL_CONTRACT_MARKER
} from './goal-contract.js'
export type { GoalContract } from './goal-contract.js'
export { decideInterrupt } from './interrupt-policy.js'
export type { InterruptAction, InterruptDecision } from './interrupt-policy.js'
export {
  selectTactics,
  appendFailureCase,
  listFailureCases,
  listFailureCasesByAttribution,
  upsertGapPattern,
  seedDefaultTactics,
  listDraftTactics,
  listTactics,
  markTacticValidated,
  draftTacticFromFailure,
  ensureT1018Draft,
  backtestAndPromote,
  promoteAllDrafts,
  writePromoteReport,
  MAP_OBJECT_KEY_TACTIC_ID,
  setTacticEnabled,
  setFailureCaseEnabled,
  rollbackTactic,
  isSeedTactic
} from './experience/index.js'
export type { PromoteResult, PromoteCaseResult, BacktestRunner } from './experience/index.js'
