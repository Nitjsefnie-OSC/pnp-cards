import { PlanError } from '../lib/plan';
import { buildPdf, type BuildInput } from '../pdf/buildPdf';
import { serveTask } from './serveTask';

serveTask<BuildInput>(buildPdf, (err) => ({
  code: err instanceof PlanError ? err.code : 'unknown',
}));
