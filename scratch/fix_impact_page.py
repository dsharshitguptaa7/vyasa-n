with open('frontend/src/admin/pages/anudaan/AnudaanImpactPage.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace(
    "import { Button, Badge, Modal, Input, Select, PageContainer } from '@vyasa/ui';",
    "import { Button, Modal, Input } from '@vyasa/ui';"
)
c = c.replace("import { useAuth } from '../../../context/AuthContext';\n", '')
c = c.replace("  AnudaanDisbursementCreate,\n", '')
c = c.replace("  const { user } = useAuth();\n", '')
c = c.replace(
    'Bank Incentive Disbursement Ledger\n              </h2>',
    "Bank Incentive Disbursement Ledger <span style={{ fontSize: '0.9rem', fontWeight: 500, color: '#64748B' }}>(Filtered Total: ₹{Number(totalDisbursedSum).toLocaleString('en-IN')})</span>\n              </h2>"
)

with open('frontend/src/admin/pages/anudaan/AnudaanImpactPage.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print('Impact page updated successfully')
