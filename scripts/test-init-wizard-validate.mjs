import { createDefaultWizardForm, validateStep } from './ui/init-wizard.mjs';

const base = createDefaultWizardForm();
const emptyBucketsError = validateStep('buckets', { ...base, buckets: [] });
if (emptyBucketsError !== 'Select at least one bucket.') {
  throw new Error(`expected buckets validation error, got: ${String(emptyBucketsError)}`);
}

const missingBucketsError = validateStep('buckets', { ...base, buckets: undefined });
if (missingBucketsError !== 'Select at least one bucket.') {
  throw new Error(`expected defensive buckets validation error, got: ${String(missingBucketsError)}`);
}

const ok = validateStep('buckets', { ...base, buckets: ['A'] });
if (ok != null) {
  throw new Error(`expected no buckets validation error, got: ${String(ok)}`);
}

console.log('test-init-wizard-validate ok');
