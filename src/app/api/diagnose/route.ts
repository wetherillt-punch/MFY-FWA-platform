import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { Claim } from '@/types/detection';
import { normalizeDateToYYYYMMDD } from '@/lib/detection/date-utils';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(worksheet);

    const claims: Claim[] = rawData.map((row: any) => ({
      claim_id: String(row.claim_id || ''),
      provider_id: String(row.provider_id || ''),
      member_id: String(row.member_id || ''),
      service_date: normalizeDateToYYYYMMDD(row.service_date || ''),
      billed_amount: String(row.billed_amount || '0'),
      paid_amount: String(row.paid_amount || ''),
      cpt_hcpcs: String(row.cpt_hcpcs || ''),
      cpt_description: String(row.cpt_description || ''),
      modifiers: String(row.modifiers || ''),
      place_of_service: String(row.place_of_service || ''),
      diagnosis_code: String(row.diagnosis_code || '')
    }));

    const p90001 = claims.filter(c => c.provider_id === 'P90001');
    
    const dupeCheck = new Map();
    const duplicates: any[] = [];
    
    p90001.forEach(claim => {
      const key = `${claim.member_id}-${claim.service_date}-${claim.cpt_hcpcs}-${claim.billed_amount}`;
      if (dupeCheck.has(key)) {
        duplicates.push({
          key,
          claim_id: claim.claim_id,
          member_id: claim.member_id,
          service_date: claim.service_date,
          cpt_hcpcs: claim.cpt_hcpcs,
          billed_amount: claim.billed_amount
        });
      } else {
        dupeCheck.set(key, claim);
      }
    });

    return NextResponse.json({
      success: true,
      totalClaims: claims.length,
      p90001Count: p90001.length,
      p90001Sample: p90001.slice(0, 5),
      duplicatesFound: duplicates.length,
      duplicates: duplicates
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
