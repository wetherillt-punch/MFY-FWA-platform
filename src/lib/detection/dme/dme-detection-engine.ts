import { detectRefillTooSoon } from './rules/refill-too-soon';
import { detectModifierMisuse } from './rules/modifier-misuse';
import { detectRentalCapExceeded } from './rules/rental-cap-exceeded';
import { detectSerialReuse } from './rules/serial-reuse';
import { detectOrphanJCodes } from './rules/orphan-j-codes';
import { detectInstitutionalOverlap } from './rules/institutional-overlap';
import { detectSupplyVelocityDrift } from './rules/supply-velocity-drift';
import { detectCodeMixShift } from './rules/code-mix-shift';
import { detectDenialPatternExploits } from './rules/denial-pattern-exploits';
import { DMEAnomaly } from './dme-types';

export function runDMEDetection(claims: any[], providerId: string): DMEAnomaly[] {
  console.log(`[DME Detection] Running for provider ${providerId}, ${claims.length} total claims`);
  const anomalies: DMEAnomaly[] = [];

  // Tier A Rules (High Confidence)
  console.log("[DME Detection] Checking Refill-Too-Soon...");
  const refillAnomaly = detectRefillTooSoon(claims, providerId);
  if (refillAnomaly) anomalies.push(refillAnomaly);

  console.log("[DME Detection] Checking Rental-Cap-Exceeded...");
  const rentalCapAnomaly = detectRentalCapExceeded(claims, providerId);
  if (rentalCapAnomaly) anomalies.push(rentalCapAnomaly);

  console.log("[DME Detection] Checking Serial-Reuse...");
  const serialReuseAnomaly = detectSerialReuse(claims, providerId);
  if (serialReuseAnomaly) anomalies.push(serialReuseAnomaly);

  // Tier B Rules (Medium Confidence)
  console.log("[DME Detection] Checking Modifier-Misuse...");
  const modifierAnomaly = detectModifierMisuse(claims, providerId);
  if (modifierAnomaly) anomalies.push(modifierAnomaly);

  console.log("[DME Detection] Checking Orphan-J-Codes...");
  const orphanJCodeAnomaly = detectOrphanJCodes(claims, providerId);
  if (orphanJCodeAnomaly) anomalies.push(orphanJCodeAnomaly);

  console.log("[DME Detection] Checking Institutional-Overlap...");
  const institutionalAnomaly = detectInstitutionalOverlap(claims, providerId);
  if (institutionalAnomaly) anomalies.push(institutionalAnomaly);

  // Tier C Rules (Watchlist) - DISABLED to reduce noise
  // These create more false positives than actionable leads
  // Re-enable once thresholds are better calibrated
  
  // console.log("[DME Detection] Checking Supply-Velocity-Drift...");
  // const velocityAnomaly = detectSupplyVelocityDrift(claims, providerId);
  // if (velocityAnomaly) anomalies.push(velocityAnomaly);

  // console.log("[DME Detection] Checking Code-Mix-Shift...");
  // const codeMixAnomaly = detectCodeMixShift(claims, providerId);
  // if (codeMixAnomaly) anomalies.push(codeMixAnomaly);

  // console.log("[DME Detection] Checking Denial-Pattern-Exploits...");
  // const denialAnomaly = detectDenialPatternExploits(claims, providerId);
  // if (denialAnomaly) anomalies.push(denialAnomaly);

  console.log(`[DME Detection] Found ${anomalies.length} anomalies for ${providerId}`);
  return anomalies;
}
