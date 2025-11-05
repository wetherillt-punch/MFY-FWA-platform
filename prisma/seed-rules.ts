import { PrismaClient, RuleCategory, RuleSeverity, RuleStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding detection rules...\n');

  const rules = [
    {
      name: 'Upcoding Detection',
      description: 'Identifies systematic billing of higher-level E&M codes',
      category: RuleCategory.BILLING,
      severity: RuleSeverity.HIGH,
      tier: 'tier2',
      cptCodes: ['99214', '99215'],
      modifiers: [],
      thresholds: { highLevelPercentage: 0.75 },
      generatedCode: 'export function detectUpcoding(claims) { return []; }',
      status: RuleStatus.ACTIVE,
      isBuiltIn: true,
      isActive: true,
      createdBy: 'system'
    },
    {
      name: 'Same-Day Duplicate Services',
      description: 'Detects identical services billed multiple times on same day',
      category: RuleCategory.BILLING,
      severity: RuleSeverity.HIGH,
      tier: 'tier2',
      cptCodes: [],
      modifiers: [],
      thresholds: { maxSameDayCount: 1 },
      generatedCode: 'export function detectDuplicates(claims) { return []; }',
      status: RuleStatus.ACTIVE,
      isBuiltIn: true,
      isActive: true,
      createdBy: 'system'
    },
    {
      name: 'Modifier 25 Abuse',
      description: 'Flags inappropriate use of modifier 25',
      category: RuleCategory.BILLING,
      severity: RuleSeverity.HIGH,
      tier: 'tier2',
      cptCodes: ['99211', '99212', '99213', '99214', '99215'],
      modifiers: ['25'],
      thresholds: { modifier25Rate: 0.8 },
      generatedCode: 'export function detectModifier25(claims) { return []; }',
      status: RuleStatus.ACTIVE,
      isBuiltIn: true,
      isActive: true,
      createdBy: 'system'
    },
    {
      name: 'After-Hours Billing',
      description: 'Detects unusual after-hours billing concentration',
      category: RuleCategory.TEMPORAL,
      severity: RuleSeverity.MEDIUM,
      tier: 'tier3',
      cptCodes: [],
      modifiers: [],
      thresholds: { afterHoursRate: 0.3 },
      generatedCode: 'export function detectAfterHours(claims) { return []; }',
      status: RuleStatus.ACTIVE,
      isBuiltIn: true,
      isActive: true,
      createdBy: 'system'
    },
    {
      name: 'Peer Comparison Outliers',
      description: 'Detects providers deviating from peer group',
      category: RuleCategory.NETWORK,
      severity: RuleSeverity.MEDIUM,
      tier: 'tier1',
      cptCodes: [],
      modifiers: [],
      thresholds: { peerDeviationFactor: 2.5 },
      generatedCode: 'export function detectPeerOutliers(claims) { return []; }',
      status: RuleStatus.ACTIVE,
      isBuiltIn: true,
      isActive: true,
      createdBy: 'system'
    }
  ];

  let created = 0;
  for (const ruleData of rules) {
    try {
      const existing = await prisma.detectionRule.findFirst({
        where: { name: ruleData.name }
      });

      if (existing) {
        console.log(`  ⏭️  Skipped: ${ruleData.name}`);
        continue;
      }

      await prisma.detectionRule.create({ data: ruleData });
      console.log(`  ✅ Created: ${ruleData.name}`);
      created++;
    } catch (error: any) {
      console.error(`  ❌ Error: ${ruleData.name}`, error.message);
    }
  }

  console.log(`\n✨ Complete! Created ${created} rules\n`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
