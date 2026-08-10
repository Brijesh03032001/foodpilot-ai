# FoodPilot --- Sky Market Frontend Design System

> **Purpose:** The implementation reference for the FoodPilot frontend.\
> Use this document to keep the Customer and Owner experiences visually
> consistent while preserving the distinctive **Sky Market** light-theme
> identity.

------------------------------------------------------------------------

## 1. Design Direction

FoodPilot uses a **light, airy, outdoor-food-market visual language**
rather than the visual style of a conventional delivery application.

The design should feel:

-   Fresh and open
-   Food-first
-   Friendly and energetic
-   Slightly editorial
-   Modern without feeling like generic SaaS
-   AI-native without relying on purple/neon AI styling
-   Inspired by food trucks, outdoor markets, plants, maps, string
    lights, bowls, and street-food culture

### Core visual rule

Do **not** make every screen blue.

Sky Market uses:

-   **Misty blue** for atmosphere
-   **Petrol blue** for structure and typography
-   **Tangerine** for appetite and primary actions
-   **Butter yellow** for warmth, rewards, and highlights
-   **Leaf green** for freshness and success
-   **Turquoise** for AI, maps, charts, and informational accents
-   **White** for clean surfaces and cards

------------------------------------------------------------------------

## 2. Core Color Palette

  Token             Hex         Primary use
  ----------------- ----------- --------------------------------------
  Sky Mist          `#EEF7F8`   Main application background
  Cloud White       `#FFFFFF`   Cards, modals, navigation surfaces
  Petrol            `#123C4A`   Main headings, sidebar, important UI
  Deep Petrol       `#092E38`   Hero text, high-contrast surfaces
  Tangerine         `#FF7043`   Primary CTA and customer actions
  Tangerine Hover   `#F45B2D`   Primary button hover
  Butter Yellow     `#FFD76A`   Ratings, highlights, rewards
  Leaf Green        `#4F8F68`   Open, success, vegan/fresh states
  Turquoise         `#2A9D9A`   AI, maps, charts, secondary accent
  Soft Mint         `#E8F4EC`   Success and dietary chip backgrounds
  Soft Orange       `#FFF0E9`   Selected/attention backgrounds
  Soft Yellow       `#FFF6D8`   Conditions and rewards
  Soft Blue         `#E1F2F5`   AI/tool/location surfaces

### Important restriction

Avoid introducing purple into the FoodPilot visual system. AI elements
should use **petrol + turquoise + misty blue**, not generic purple AI
gradients.

------------------------------------------------------------------------

## 3. Color Distribution

A useful approximate visual balance:

-   **70%** Cloud / Misty Blue
-   **15%** Petrol
-   **7%** Tangerine
-   **4%** Leaf Green
-   **2%** Butter Yellow
-   **2%** Turquoise

This is a guideline rather than a mathematical requirement.

The interface should remain quiet enough that food photography and
FoodPilot illustrations become the most visually expressive elements.

------------------------------------------------------------------------

## 4. Background Hierarchy

``` css
--bg-page:        #EEF7F8;
--bg-page-soft:   #F6FBFB;
--bg-card:        #FFFFFF;
--bg-card-alt:    #F8FCFC;
--bg-elevated:    #FFFFFF;

--bg-petrol:      #123C4A;
--bg-petrol-deep: #092E38;

--bg-orange-soft: #FFF0E9;
--bg-green-soft:  #E8F4EC;
--bg-yellow-soft: #FFF6D8;
--bg-blue-soft:   #E1F2F5;
```

### Main page background

Use an extremely subtle gradient so the application feels almost white
while still having atmosphere.

``` css
background:
  linear-gradient(
    180deg,
    #F6FBFB 0%,
    #EEF7F8 48%,
    #F8FCFC 100%
  );
```

Avoid strong blue gradients across normal application screens.

------------------------------------------------------------------------

## 5. Typography

FoodPilot uses two complementary typography personalities.

### Primary UI font --- Manrope

Use **Manrope** for:

-   Navigation
-   Buttons
-   Cards
-   Prices
-   Dashboard metrics
-   Forms
-   Chat
-   Tables
-   Labels
-   Filters
-   Chips
-   Application headings

Recommended weights:

-   `400` --- normal text
-   `500` --- UI labels
-   `600` --- buttons and card titles
-   `700` --- headings
-   `800` --- large metrics and important display numbers

``` css
--font-ui: "Manrope", sans-serif;
```

### Display / editorial font --- DM Serif Display

Use **DM Serif Display** selectively for marketing and expressive
editorial headings.

Examples:

> Your Food.\
> Your Way.

> Food Made Simple,\
> Conversations Made Better.

Do **not** use the serif font throughout the application.

``` css
--font-display: "DM Serif Display", serif;
```

The serif gives the food/marketing experience personality, while Manrope
keeps the application interface modern and readable.

------------------------------------------------------------------------

## 6. Typography Scale

``` css
--text-xs:   12px;
--text-sm:   14px;
--text-base: 16px;
--text-lg:   18px;
--text-xl:   20px;
--text-2xl:  24px;
--text-3xl:  30px;
--text-4xl:  38px;
--text-5xl:  48px;
--text-6xl:  64px;
```

### Landing hero

``` css
font-family: var(--font-display);
font-size: clamp(48px, 5.5vw, 76px);
line-height: 0.98;
letter-spacing: -0.035em;
```

### Application page heading

``` css
font-family: var(--font-ui);
font-size: 32px;
font-weight: 700;
line-height: 1.15;
letter-spacing: -0.025em;
color: #123C4A;
```

### Card heading

``` css
font-family: var(--font-ui);
font-size: 17px;
font-weight: 700;
line-height: 1.3;
```

### Body text

``` css
font-family: var(--font-ui);
font-size: 15px;
font-weight: 400;
line-height: 1.65;
color: #526970;
```

### Dashboard KPI

``` css
font-family: var(--font-ui);
font-size: 32px;
font-weight: 800;
line-height: 1;
letter-spacing: -0.035em;
```

------------------------------------------------------------------------

## 7. Text Colors

Avoid pure black.

``` css
--text-primary:   #123C4A;
--text-strong:    #092E38;
--text-secondary: #526970;
--text-muted:     #82979D;
--text-disabled:  #A9B9BD;
--text-inverse:   #FFFFFF;
--text-accent:    #FF7043;
```

### Recommended hierarchy

-   Hero/display: Deep Petrol
-   Main headings: Petrol
-   Body: Secondary
-   Supporting metadata: Muted
-   Links/important food actions: Tangerine
-   Inverse text: White

------------------------------------------------------------------------

## 8. Primary Buttons

Primary commerce/customer actions use **Tangerine**.

Examples:

-   Add to Order
-   Proceed to Checkout
-   Send to Kitchen
-   Confirm
-   Find Food Now

``` css
.btn-primary {
  background: #FF7043;
  color: #FFFFFF;
  border: 0;
  border-radius: 14px;
  padding: 13px 22px;
  font-weight: 700;

  box-shadow:
    0 6px 16px rgba(255, 112, 67, 0.20);

  transition:
    transform 180ms ease,
    box-shadow 180ms ease,
    background-color 180ms ease;
}

.btn-primary:hover {
  background: #F45B2D;
  transform: translateY(-1px);

  box-shadow:
    0 9px 22px rgba(255, 112, 67, 0.25);
}
```

### Meaning

**Orange = commerce / important customer action.**

Avoid using orange indiscriminately for decoration.

------------------------------------------------------------------------

## 9. Secondary Buttons

``` css
.btn-secondary {
  border: 1.5px solid #123C4A;
  background: #FFFFFF;
  color: #123C4A;
  border-radius: 14px;
}

.btn-secondary:hover {
  background: #E1F2F5;
}
```

### AI actions

Use Petrol:

``` css
.btn-ai {
  background: #123C4A;
  color: #FFFFFF;
}
```

### Interaction semantics

-   **Tangerine** = order, buy, continue, confirm
-   **Petrol** = AI, navigation, secondary product action
-   **Green** = success/state rather than normal CTA

------------------------------------------------------------------------

## 10. Cards

FoodPilot is card-heavy, so cards need a consistent implementation.

``` css
.card {
  background: #FFFFFF;

  border:
    1px solid rgba(18, 60, 74, 0.08);

  border-radius: 20px;

  box-shadow:
    0 2px 4px rgba(18, 60, 74, 0.02),
    0 10px 30px rgba(18, 60, 74, 0.055);
}
```

Food images inside cards:

``` css
.card-image {
  border-radius: 16px;
  overflow: hidden;
  object-fit: cover;
}
```

Avoid oversized, dark shadows.

------------------------------------------------------------------------

## 11. Border Radius System

``` css
--radius-xs:   8px;
--radius-sm:   10px;
--radius-md:   14px;
--radius-lg:   18px;
--radius-xl:   24px;
--radius-2xl:  32px;
--radius-pill: 999px;
```

Recommended mapping:

  Element            Radius
  ------------- -----------
  Inputs             `14px`
  Buttons            `14px`
  Small cards        `16px`
  Main cards         `20px`
  Hero images     `28–32px`
  Modal              `24px`
  Chips             `999px`
  Avatars           `999px`

Friendly rounding is part of FoodPilot's identity, but not every
component should become a pill.

------------------------------------------------------------------------

## 12. Search and Inputs

Natural-language search is one of the most important FoodPilot
components.

``` css
.search-input {
  background: #FFFFFF;
  border: 1px solid #DCE8EA;
  border-radius: 16px;
  height: 52px;

  box-shadow:
    0 5px 20px rgba(18, 60, 74, 0.05);
}

.search-input:focus {
  border-color: #2A9D9A;

  box-shadow:
    0 0 0 4px rgba(42, 157, 154, 0.12);
}
```

Search submit control:

``` css
.search-submit {
  background: #FF7043;
  color: #FFFFFF;
  border-radius: 12px;
}
```

------------------------------------------------------------------------

## 13. Chips and Badges

FoodPilot uses chips for:

-   Parsed intent
-   Dietary restrictions
-   Cuisine
-   Price
-   Open-now
-   AI tool traces
-   Modifier conditions
-   Availability
-   Status

### Normal

``` css
background: #F5FAFA;
color: #526970;
border: 1px solid #DCE8EA;
```

### Vegan / dietary / success

``` css
background: #E8F4EC;
color: #356D4B;
```

### AI / parsed intent / informational

``` css
background: #E1F2F5;
color: #123C4A;
```

### Conditions / rewards

``` css
background: #FFF6D8;
color: #795E0A;
```

### Warning / attention

``` css
background: #FFF0E9;
color: #C94D2A;
```

------------------------------------------------------------------------

## 14. Semantic Colors

``` css
--success:    #3D8B5C;
--success-bg: #E8F4EC;

--warning:    #D99A20;
--warning-bg: #FFF6D8;

--danger:     #D94C3D;
--danger-bg:  #FDECEA;

--info:       #2A8E9B;
--info-bg:    #E1F2F5;
```

Recommended meanings:

  State                  Color
  ---------------------- -----------------------
  Open now               Green
  Available              Green
  Out of stock           Red
  Rejected modifier      Red
  Limited availability   Yellow
  Applied modification   Green
  Condition satisfied    Yellow + green check
  AI processing          Turquoise
  Informational state    Turquoise / soft blue

------------------------------------------------------------------------

## 15. Food Photography

Food should be **more saturated and visually rich than the UI**.

### Principle

**Quiet UI + appetizing food = food gets immediate attention.**

Food imagery should have:

-   Warm highlights
-   Strong but natural saturation
-   Rich texture
-   Good ingredient separation
-   High visual clarity
-   Minimal blue cast

``` css
.food-image {
  object-fit: cover;
}
```

Avoid blue overlays over food photography.

------------------------------------------------------------------------

## 16. Illustration Language

FoodPilot's illustration style is:

> **Semi-3D editorial illustration + soft vector shading**

### Characteristics

-   Rounded geometry
-   Soft shadows
-   Subtle texture
-   Petrol/teal details
-   Warm tangerine highlights
-   Leafy vegetation
-   Outdoor market environments
-   Food trucks
-   String lights
-   Market umbrellas
-   Plants
-   Friendly people
-   Food bowls
-   Small hand-drawn accent marks

### Avoid

-   Corporate stock illustration
-   Neon cyberpunk styling
-   Generic delivery scooters
-   Purple AI gradients
-   Excessive glassmorphism
-   Mixing highly realistic assets randomly with flat vector assets
-   Heavy black backgrounds in the light theme

------------------------------------------------------------------------

## 17. FoodPilot Visual Motifs

Use these subtly throughout the product:

-   Leaves and small botanical forms
-   Map pins
-   Route lines
-   Food-truck silhouettes
-   String lights
-   Outdoor market sun
-   Bowls
-   Market umbrellas
-   Hand-drawn spark marks
-   Hand-drawn underline strokes
-   Small stars for delight/rewards

Good uses include an orange hand-drawn underline beneath phrases such
as:

-   `near you`
-   `Real vibes.`
-   `Your Way.`

These imperfections help FoodPilot avoid looking like a generic SaaS
template.

------------------------------------------------------------------------

## 18. Spacing System

Use an 8px-derived system.

``` css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;
--space-24: 96px;
```

Desktop application container:

``` css
.app-container {
  max-width: 1440px;
  margin: 0 auto;
  padding-inline: 32px;
}
```

Landing-page sections can use:

``` css
.marketing-section {
  padding-block: 96px;
}
```

------------------------------------------------------------------------

## 19. Customer Navigation

Customer navigation should remain mostly white/light.

``` css
.customer-nav {
  background: rgba(255, 255, 255, 0.92);
}
```

Active navigation:

``` css
.customer-nav .active {
  color: #123C4A;
  font-weight: 700;
}
```

Use a small Tangerine underline, indicator, or icon accent for the
selected section.

Customer UI should feel like an **outdoor marketplace**.

------------------------------------------------------------------------

## 20. Owner Navigation

Owner navigation may use a stronger Petrol surface to distinguish the
business operating system from the customer marketplace.

``` css
.owner-sidebar {
  background: #123C4A;
  color: rgba(255, 255, 255, 0.72);
}
```

Selected item:

``` css
.owner-sidebar .active {
  background: #E1F2F5;
  color: #123C4A;
}
```

### Experience distinction

**Customer side = marketplace**

**Owner side = operating system**

They should feel related, not like two separate brands.

------------------------------------------------------------------------

## 21. Dashboard Charts

Avoid rainbow-colored dashboards.

### Chart colors

``` css
--chart-primary:  #2A9D9A;
--chart-previous: #B9D7DB;
--chart-positive: #4F8F68;
--chart-negative: #D95836;
--chart-highlight:#FF7043;
--chart-grid:     #E6EFF0;
```

### Recommended use

-   Main sales trend → Turquoise
-   Previous period → Muted blue-gray
-   Positive change → Leaf Green
-   Negative change → Terracotta/red
-   Selected/highlighted data → Tangerine
-   Gridlines → Very light blue-gray

The Owner Dashboard should be visually calmer than the customer
experience.

------------------------------------------------------------------------

## 22. AI Visual Identity

FoodPilot AI should have its own recognizable visual system without
becoming a separate brand.

### AI colors

``` css
--ai-background: #E1F2F5;
--ai-accent:     #2A9D9A;
--ai-strong:     #123C4A;
--ai-warm:       #FFD76A;
```

### Robot mascot

The FoodPilot robot should use:

-   White body
-   Petrol/dark-teal face
-   Turquoise highlights
-   Small Tangerine details
-   Butter-yellow light/antenna accents
-   Friendly rounded proportions
-   No "Sky Market" text on the mascot itself

### AI thinking indicator

Suggested animation sequence:

**Turquoise dot → Butter dot → Turquoise dot**

Avoid generic purple glowing dots.

------------------------------------------------------------------------

## 23. Chat UI

### Customer message

``` css
.chat-user {
  background: #123C4A;
  color: #FFFFFF;
  border-radius: 18px 18px 5px 18px;
}
```

### FoodPilot AI message

``` css
.chat-ai {
  background: #FFFFFF;
  color: #123C4A;
  border: 1px solid #DCE8EA;
  border-radius: 18px 18px 18px 5px;
}
```

### Tool trace

``` css
.tool-trace {
  background: #E1F2F5;
  color: #526970;
}
```

Embedded recommendation cards should remain mostly white.

------------------------------------------------------------------------

## 24. Order Builder

The Order Builder is a showcase screen and should make AI parsing and
verification visually understandable.

### Standard item

``` css
.order-line {
  background: #FFFFFF;
}
```

### Applied modification

``` css
.modification-applied {
  border-left: 3px solid #4F8F68;
  background: #F7FCF8;
}
```

### Rejected modification

``` css
.modification-rejected {
  border-left: 3px solid #D94C3D;
  background: #FFF8F7;
}
```

### Condition met

Use a Soft Yellow chip with a green check.

### Total area

``` css
.order-total {
  background: #123C4A;
  color: #FFFFFF;
}
```

The final `Proceed to Checkout` / `Send to Kitchen` action should use
Tangerine.

------------------------------------------------------------------------

## 25. Shadows

Standardize shadows rather than inventing them component-by-component.

``` css
--shadow-xs:
  0 1px 3px rgba(18, 60, 74, 0.05);

--shadow-sm:
  0 4px 12px rgba(18, 60, 74, 0.06);

--shadow-md:
  0 10px 30px rgba(18, 60, 74, 0.08);

--shadow-lg:
  0 22px 55px rgba(18, 60, 74, 0.10);
```

Recommended usage:

-   Chips / tiny floating elements → `shadow-xs`
-   Normal cards → `shadow-sm`
-   Popovers / elevated cards → `shadow-md`
-   Hero illustrations → `shadow-lg`

------------------------------------------------------------------------

## 26. Borders

``` css
--border-light:  #E4EDEF;
--border-default:#D8E6E8;
--border-strong: #BDD1D5;
```

Most cards:

``` css
border: 1px solid var(--border-light);
```

Prefer a combination of subtle borders and light shadows rather than
relying only on shadows.

------------------------------------------------------------------------

## 27. Motion

FoodPilot can have subtle personality without becoming distracting.

``` css
transition:
  transform 180ms ease,
  box-shadow 180ms ease,
  background-color 180ms ease;
```

### Card hover

``` css
.card:hover {
  transform: translateY(-3px);
}
```

### Food image hover

``` css
.card:hover .food-image {
  transform: scale(1.025);
}
```

### Button hover

``` css
button:hover {
  transform: translateY(-1px);
}
```

### Optional branded motion

-   Robot mascot → tiny floating movement
-   Map truck → subtle movement along route
-   Search spark → small entrance animation
-   Success check → quick scale/fade
-   Reward star → gentle pop

Avoid excessive animation in the Owner Dashboard.

------------------------------------------------------------------------

## 28. Responsive Principles

FoodPilot should work from desktop down to phone widths.

### Desktop

-   Multi-column layouts
-   Persistent order panel where useful
-   Owner sidebar
-   Large food imagery
-   Spacious dashboard

### Tablet

-   Reduce columns
-   Allow horizontal filters where appropriate
-   Collapse persistent side panels into drawers

### Mobile

-   Single-column layouts
-   Bottom navigation for Customer experience
-   Sticky cart/order action
-   Full-width chat
-   Owner sidebar becomes drawer/navigation sheet
-   Charts become vertically stacked
-   Tables should allow horizontal scrolling or switch to compact card
    rows

------------------------------------------------------------------------

## 29. Screen-Specific Visual Direction

### Discover

-   Large natural-language search
-   Parsed-intent chips
-   Rich recommendation cards
-   Food photography gets priority
-   Light mist background
-   Tangerine search/action control
-   Green `Open now`
-   Petrol typography

### Truck Detail / Menu

-   Large truck hero image
-   White menu cards
-   Strong availability information
-   Food photos
-   Sticky cart/order affordance
-   Petrol and green for metadata
-   Tangerine `Add` controls

### Concierge

-   Robot mascot
-   White AI bubbles
-   Petrol user bubbles
-   Recommendation cards inside chat
-   Soft-blue AI/tool surfaces
-   Tangerine only for order actions

### Order Builder

-   Structured and highly readable
-   Applied/rejected states visibly different
-   Conditions shown as badges
-   Persistent live total
-   Petrol total block
-   Tangerine checkout CTA

### Review & Confirm

-   Calm, high-trust layout
-   Clear itemized summary
-   Irreversible `Send to Kitchen` action gets the strongest Tangerine
    treatment
-   Editing remains secondary

### Order Status

-   Friendly progress visualization
-   Map/route illustration where useful
-   Green completed steps
-   Tangerine active/current step
-   Petrol labels
-   Pickup information on white cards

### Owner Dashboard

-   Petrol sidebar
-   White content cards
-   Turquoise charts
-   Green positive deltas
-   Minimal Tangerine
-   High information density without clutter

### Sales Analytics

-   Larger charts
-   Chart/table toggle
-   Strong date/truck filters
-   Same restrained analytical palette

### Review Intelligence

-   Sentiment visualizations
-   Complaint bars
-   Representative review cards
-   Red/orange only for negative/problem areas
-   Green for positive sentiment
-   Turquoise for neutral/information

### Owner Copilot

-   AI visual language
-   Evidence cards
-   Tool-running states
-   Soft-blue processing surfaces
-   Petrol response structure
-   Tangerine only where a business action requires attention

------------------------------------------------------------------------

## 30. Image and Asset Direction

Assets created for the FoodPilot visual system should follow these
rules.

### Food-truck imagery

-   Distinct truck personalities
-   Outdoor market environments
-   Teal/petrol structure
-   Warm orange/yellow lighting
-   Plants and market details
-   String lights where appropriate
-   Avoid generic delivery branding

### Map imagery

-   Isometric or softly illustrated
-   Misty-blue ground
-   Petrol/turquoise route
-   Tangerine location pin
-   Leaf-green trees
-   Small truck icon
-   Minimal/no baked-in UI text

### People illustrations

-   Friendly
-   Warm
-   Diverse
-   Soft semi-3D/vector style
-   Sky Market palette clothing
-   Prefer transparent backgrounds when used as UI assets

### Icons/mascots

When an asset can be implemented with code or an icon library, prefer
code.

Generate custom images primarily for:

-   Food trucks
-   Hero scenes
-   Robot mascot
-   People illustrations
-   Food compositions
-   Marketing/editorial scenes
-   Decorative map illustrations

Avoid baking buttons, headings, body copy, or other normal UI text into
images.

------------------------------------------------------------------------

## 31. Accessibility

Visual beauty should not reduce usability.

### Minimum requirements

-   Body text should maintain sufficient contrast against backgrounds
-   Do not use color as the only indicator of status
-   Applied/rejected states should include icons and text
-   Focus rings must be visible
-   Buttons should have comfortable hit areas
-   Charts should have table equivalents where appropriate
-   Loading states should include text rather than animation alone
-   Respect `prefers-reduced-motion`

Example focus:

``` css
:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 4px rgba(42, 157, 154, 0.18);
}
```

------------------------------------------------------------------------

## 32. Master CSS Variables

Use this as the initial design-token layer.

``` css
:root {
  /* Brand */
  --sky-mist: #EEF7F8;
  --cloud: #FFFFFF;

  --petrol: #123C4A;
  --petrol-deep: #092E38;

  --tangerine: #FF7043;
  --tangerine-hover: #F45B2D;

  --butter: #FFD76A;
  --leaf: #4F8F68;
  --turquoise: #2A9D9A;

  /* Background */
  --bg: #EEF7F8;
  --bg-soft: #F6FBFB;
  --surface: #FFFFFF;
  --surface-alt: #F8FCFC;

  /* Soft accents */
  --mint-soft: #E8F4EC;
  --blue-soft: #E1F2F5;
  --orange-soft: #FFF0E9;
  --yellow-soft: #FFF6D8;

  /* Text */
  --text: #123C4A;
  --text-strong: #092E38;
  --text-secondary: #526970;
  --text-muted: #82979D;
  --text-disabled: #A9B9BD;

  /* Semantic */
  --success: #3D8B5C;
  --warning: #D99A20;
  --danger: #D94C3D;
  --info: #2A8E9B;

  /* Border */
  --border-light: #E4EDEF;
  --border: #D8E6E8;
  --border-strong: #BDD1D5;

  /* Radius */
  --radius-xs: 8px;
  --radius-sm: 10px;
  --radius-md: 14px;
  --radius-lg: 18px;
  --radius-xl: 24px;
  --radius-2xl: 32px;
  --radius-pill: 999px;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;
  --space-20: 80px;
  --space-24: 96px;

  /* Typography */
  --font-ui: "Manrope", sans-serif;
  --font-display: "DM Serif Display", serif;

  /* Shadows */
  --shadow-xs:
    0 1px 3px rgba(18, 60, 74, 0.05);

  --shadow-sm:
    0 4px 12px rgba(18, 60, 74, 0.06);

  --shadow-md:
    0 10px 30px rgba(18, 60, 74, 0.08);

  --shadow-lg:
    0 22px 55px rgba(18, 60, 74, 0.10);

  /* Charts */
  --chart-primary: #2A9D9A;
  --chart-previous: #B9D7DB;
  --chart-positive: #4F8F68;
  --chart-negative: #D95836;
  --chart-highlight: #FF7043;
  --chart-grid: #E6EFF0;
}
```

------------------------------------------------------------------------

## 33. FoodPilot Visual Formula

When deciding whether a new component belongs in FoodPilot, ask:

1.  Is the interface primarily light and airy?
2.  Is Petrol doing the structural work instead of black?
3.  Is Tangerine reserved for meaningful action/appetite?
4.  Is Green communicating freshness or success?
5.  Is Turquoise communicating AI, information, maps, or analytics?
6.  Does the food remain more visually saturated than the UI?
7.  Are illustrations connected to outdoor food-market culture?
8.  Does the component avoid generic purple AI styling?
9.  Does the component feel friendly without becoming childish?
10. Could this plausibly belong to a modern outdoor food market rather
    than a generic delivery app?

If most answers are **yes**, the component is probably aligned with
FoodPilot.

------------------------------------------------------------------------

## 34. Final Design Principle

> **The frontend should not compete with the food, trucks, people, and
> illustrations. It should frame them.**

The strongest FoodPilot experience comes from the combination of:

**airy Sky Market interface + rich food imagery + distinctive trucks +
friendly AI + outdoor-market details + disciplined product UI.**

That is the core visual identity to preserve while implementing every
Customer and Owner screen.
