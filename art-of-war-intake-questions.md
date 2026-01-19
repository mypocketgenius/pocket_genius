# Art of War Intake Questions for Startup Employees

These 5 questions are designed to help personalize Art of War advice for startup employees by understanding their context, challenges, and strategic situation.

## Question 1: Role/Position
**Question Text:** "What is your role in the startup?"
**Slug:** `role`
**Response Type:** `SELECT`
**Helper Text:** "This helps us tailor advice to your specific responsibilities and decision-making scope."
**Display Order:** 1
**Is Required:** true
**Options:**
- Founder/CEO
- Co-founder/Executive
- Head of Department (Sales, Marketing, Product, Engineering, etc.)
- Manager/Team Lead
- Individual Contributor
- Other

## Question 2: Company Stage
**Question Text:** "What stage is your startup currently in?"
**Slug:** `company_stage`
**Response Type:** `SELECT`
**Helper Text:** "Understanding your company's stage helps us provide contextually relevant strategic advice."
**Display Order:** 2
**Is Required:** true
**Options:**
- Pre-seed/Idea stage (0-5 employees)
- Seed stage (5-15 employees, initial product)
- Series A (15-50 employees, product-market fit)
- Series B+ (50+ employees, scaling)
- Growth stage (100+ employees, market expansion)

## Question 3: Primary Challenge
**Question Text:** "What is your primary business challenge right now?"
**Slug:** `primary_challenge`
**Response Type:** `MULTI_SELECT`
**Helper Text:** "Select all that apply. This helps us focus on the strategic areas where you need guidance."
**Display Order:** 3
**Is Required:** true
**Options:**
- Customer acquisition and growth
- Competitive positioning
- Team building and leadership
- Product development and innovation
- Market expansion
- Fundraising and investor relations
- Operational efficiency
- Pivot or strategic direction change
- Other

## Question 4: Team Size
**Question Text:** "How many people are in your immediate team or department?"
**Slug:** `team_size`
**Response Type:** `SELECT`
**Helper Text:** "This helps us understand your organizational context and leadership scope."
**Display Order:** 4
**Is Required:** true
**Options:**
- Just me (solo founder/operator)
- 2-5 people
- 6-15 people
- 16-50 people
- 50+ people

## Question 5: Competitive Landscape
**Question Text:** "How would you describe your competitive landscape?"
**Slug:** `competitive_landscape`
**Response Type:** `SELECT`
**Helper Text:** "Understanding your competitive environment helps us apply Sun Tzu's principles about knowing your enemy and the terrain."
**Display Order:** 5
**Is Required:** true
**Options:**
- Highly competitive with established players
- Competitive but with clear differentiation
- Emerging market with few competitors
- Blue ocean (creating new market category)
- Not sure / unclear

---

## Implementation Notes

These questions will be stored in the `Intake_Question` table and linked to the Art of War chatbot (`chatbot_art_of_war`). The responses will be stored in `Intake_Response` and synced to `User_Context` to provide personalized context for RAG queries.

The questions are designed to:
1. **Understand the user's perspective** (role, team size)
2. **Understand the strategic context** (company stage, competitive landscape)
3. **Identify specific challenges** (primary challenge)

This information will help the RAG system retrieve and contextualize relevant passages from The Art of War that apply to their specific situation.








