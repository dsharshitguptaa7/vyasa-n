with open('frontend/src/admin/pages/AdminDashboardPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('\r\n', '\n')

old_cmd_bar = """            <Button
              variant="outline"
              size="sm"
              leftIcon={<AppIcon name="file-text" size={14} />}
              onClick={() => navigate('/admin/atharva/audit-logs')}
            >
              System Audit Trail
            </Button>
          </div>"""

new_cmd_bar = """            <Button
              variant="outline"
              size="sm"
              leftIcon={<AppIcon name="file-text" size={14} />}
              onClick={() => navigate('/admin/atharva/audit-logs')}
            >
              System Audit Trail
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<AppIcon name="layout-dashboard" size={14} />}
              onClick={() => navigate('/admin/anudaan')}
            >
              Incentive &amp; Finance
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<AppIcon name="layers" size={14} />}
              onClick={() => navigate('/admin/anudaan/gallery')}
            >
              Recognition Gallery CMS
            </Button>
          </div>"""

assert old_cmd_bar in content, "old_cmd_bar not found in AdminDashboardPage.tsx"
content = content.replace(old_cmd_bar, new_cmd_bar)

old_toggle_card = """        {/* Section 3: Module Registry Toggle Card */}
        <AdminModuleToggleCard />"""

new_section_and_toggle = """        {/* Section: ANUDAAN (Yajur Veda) Research Publication Incentive & Finance */}
        <div>
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--vyasa-gold, #b2811a)',
                marginBottom: '4px',
              }}
            >
              Yajur Veda • Research Administration &amp; Incentive Governance
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '8px' }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--vyasa-primary, #0f2b48)',
                  fontFamily: 'var(--vyasa-font-scholarly, serif)',
                }}
              >
                ANUDAAN Incentive Impact &amp; Ceremonial Recognition Console
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--vyasa-text-muted, #64748b)' }}>
                Audited financial disbursements, researcher ceremonies, and showcase configuration
              </span>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '18px',
            }}
          >
            {/* Card 1: Incentive Impact & Financial Disbursement Ledger */}
            <Card
              variant="default"
              title="Incentive Impact &amp; Financial Ledger"
              subtitle="Audited Payouts &amp; Lifecycle Ledger"
              headerAction={<Badge variant="teal">Finance Ledger</Badge>}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--vyasa-text-secondary, #4b5565)', lineHeight: 1.5 }}>
                  Track institutional claims received, approved payouts, and verified banking transaction references (UTR) under the Four-Eyes principle.
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<AppIcon name="layout-dashboard" size={14} />}
                    onClick={() => navigate('/admin/anudaan')}
                  >
                    Open Ledger &rarr;
                  </Button>
                </div>
              </div>
            </Card>

            {/* Card 2: Researcher Recognition Gallery CMS */}
            <Card
              variant="default"
              title="Researcher Recognition Gallery CMS"
              subtitle="Ceremony Showcases &amp; Consent Management"
              headerAction={<Badge variant="gold">Media CMS</Badge>}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--vyasa-text-secondary, #4b5565)', lineHeight: 1.5 }}>
                  Curate institutional photo galleries of incentive distribution ceremonies, featured researchers, and verified consent lifecycle records.
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<AppIcon name="layers" size={14} />}
                    onClick={() => navigate('/admin/anudaan/gallery')}
                  >
                    Manage Gallery &rarr;
                  </Button>
                </div>
              </div>
            </Card>

            {/* Card 3: Showcase Configuration */}
            <Card
              variant="default"
              title="Showcase Configuration"
              subtitle="Public Visibility &amp; Advisory Controls"
              headerAction={<Badge variant="neutral">Settings</Badge>}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--vyasa-text-secondary, #4b5565)', lineHeight: 1.5 }}>
                  Toggle public visibility of institutional impact metrics, ceremony showcases, default reporting academic years, and statutory notices.
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<AppIcon name="settings" size={14} />}
                    onClick={() => navigate('/admin/anudaan/config')}
                  >
                    Configure &rarr;
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Section 3: Module Registry Toggle Card */}
        <AdminModuleToggleCard />"""

assert old_toggle_card in content, "old_toggle_card not found in AdminDashboardPage.tsx"
content = content.replace(old_toggle_card, new_section_and_toggle)

with open('frontend/src/admin/pages/AdminDashboardPage.tsx', 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

print("Updated AdminDashboardPage.tsx successfully")
