import re
with open('src/lib/detection/phase3-patterns.ts', 'r') as f:
    content = f.read()
# Fix all regex.test(c.cpt_hcpcs) patterns
content = re.sub(r'(/\^[^/]+\$/)\.test\(c\.cpt_hcpcs\)', r'c.cpt_hcpcs && \1.test(c.cpt_hcpcs)', content)

with open('src/lib/detection/phase3-patterns.ts', 'w') as f:
    f.write(content)
print("Fixed all patterns!")
