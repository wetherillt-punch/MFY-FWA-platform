#!/bin/bash
for file in $(find src/lib/detection -name "*.ts" -type f); do
  # Add c.cpt_hcpcs && before any .test(c.cpt_hcpcs) that doesn't already have it
  sed -i '' 's/\([^&]\)\/\*\(.*\)\*\/\.test(c\.cpt_hcpcs)/\1c.cpt_hcpcs \&\& \/\*\2\*\/\.test(c.cpt_hcpcs)/g' "$file"
  
  # Same for claim.cpt_hcpcs
  sed -i '' 's/\([^&]\)\/\*\(.*\)\*\/\.test(claim\.cpt_hcpcs)/\1claim.cpt_hcpcs \&\& \/\*\2\*\/\.test(claim.cpt_hcpcs)/g' "$file"
done
