import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding test rules...');

  // Rule 1: High 99215 Usage (Upcoding)
  await prisma.detectionRule.create({
    data: {
      name: 'Excessive 99215 Coding',
      description: 'Flags providers billing 99215 at rates exceeding 40% (normal is 5-15%)',
      category: 'BILLING',
      severity: 'HIGH',
      tier: 'tier1',
      isBuiltIn: false,
      isActive: true,
      status: 'APPROVED',
      cptCodes: ['99215'],
      modifiers: [],
      thresholds: {
        max_frequency: 50,
        threshold_percentage: 40
      },
      generatedCode: '',
      createdBy: 'system',
      executionCount: 0,
      totalTriggers: 0,
    }
  });

  // Rule 2: Round Dollar Amounts
  await prisma.detectionRule.create({
    data: {
      name: 'Round Dollar Anchoring',
      description: 'Detects providers with >50% round-dollar billing amounts',
      category: 'BILLING',
      severity: 'MEDIUM',
      tier: 'tier2',
      isBuiltIn: false,
      isActive: true,
      status: 'APPROVED',
      cptCodes: [],
      modifiers: [],
      thresholds: {
        round_number_threshold: 50
      },
      generatedCode: '',
      createdBy: 'system',
      executionCount: 0,
      totalTriggers: 0,
    }
  });

  // Rule 3: Skin Substitute Frequency
  await prisma.detectionRule.create({
    data: {
      name: 'Wound Care Frequency Violation',
      description: 'Flags skin substitute procedures performed <14 days apart',
      category: 'TEMPORAL',
      severity: 'HIGH',
      tier: 'tier1',
      isBuiltIn: false,
      isActive: true,
      status: 'APPROVED',
      cptCodes: ['15275', '15276'],
      modifiers: [],
      thresholds: {
        min_days_between: 14
      },
      generatedCode: '',
      createdBy: 'system',
      executionCount: 0,
      totalTriggers: 0,
    }
  });

  // Rule 4: Excessive DME Billing
  await prisma.detectionRule.create({
    data: {
      name: 'DME Billing Rate Anomaly',
      description: 'Flags providers with >30% DME billing (Q-codes)',
      category: 'DME',
      severity: 'MEDIUM',
      tier: 'tier2',
      isBuiltIn: false,
      isActive: true,
      status: 'APPROVED',
      cptCodes: ['Q4101', 'E0601', 'A4216', 'A4217'],
      modifiers: [],
      thresholds: {
        max_dme_rate: 30
      },
      generatedCode: '',
      createdBy: 'system',
      executionCount: 0,
      totalTriggers: 0,
    }
  });

  // Rule 5: Modifier 25 Abuse
  await prisma.detectionRule.create({
    data: {
      name: 'Modifier 25 Overuse',
      description: 'Flags providers using modifier 25 on >40% of claims',
      category: 'BILLING',
      severity: 'MEDIUM',
      tier: 'tier2',
      isBuiltIn: false,
      isActive: true,
      status: 'APPROVED',
      cptCodes: [],
      modifiers: ['25'],
      thresholds: {
        max_modifier_rate: 40
      },
      generatedCode: '',
      createdBy: 'system',
      executionCount: 0,
      totalTriggers: 0,
    }
  });

  console.log('✅ Seeded 5 test rules!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });