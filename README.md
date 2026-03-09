# Alice for Arkansas - ALICE Data Assistant

An ElizaOS-powered AI assistant that provides accurate Arkansas ALICE (Asset Limited, Income Constrained, Employed) data through CSV-based actions and knowledge retrieval.

## Features

- **CSV-Based Data Retrieval**: Accurate county, subcounty, demographic, and employment data from CSV files
- **County & City Queries**: Search by county name, city, township, or zip code
- **Comparison Analysis**: Compare multiple counties with detailed breakdowns
- **Demographic Data**: Race, ethnicity, and household type breakdowns
- **Employment Sectors**: Industry-specific ALICE statistics
- **Trend Analysis**: Historical data tracking over time
- **Statewide Statistics**: Arkansas-wide ALICE metrics
- **Knowledge Base**: Conceptual ALICE information with retrieval system
- **WordPress Integration**: Optional custom chat widget for WordPress sites (see bottom of README)

## Prerequisites

Before installing, ensure you have the following installed on your machine:

### Required

1. **Node.js** (v18 or higher)
   - Download from [nodejs.org](https://nodejs.org/)
   - Verify installation: `node --version`

2. **npm** (comes with Node.js)
   - Verify installation: `npm --version`

3. **Git** (for cloning the repository)
   - Download from [git-scm.com](https://git-scm.com/)
   - Verify installation: `git --version`

### Optional but Recommended

- **Bun** (fast JavaScript runtime, alternative to npm)
  - Install: `curl -fsSL https://bun.sh/install | bash`
  - Verify: `bun --version`

## Installation

### Step 1: Clone the Repository

```bash
git clone <repository-url>
cd my-agent
```

### Step 2: Install Dependencies

Using npm:
```bash
npm install
```

Or using bun (faster):
```bash
bun install
```

### Step 3: Set Up Environment Variables

Create a `.env` file in the root directory. **For local development**, you only need the required API keys:

```bash
# Required: OpenRouter API for text generation
OPENROUTER_API_KEY=your_openrouter_api_key_here
TEXT_MODEL=anthropic/claude-3.5-sonnet

# Required: OpenAI API for embeddings
OPENAI_API_KEY=your_openai_api_key_here
TEXT_EMBEDDING_MODEL=text-embedding-3-small

# Knowledge system configuration
KNOWLEDGE_PATH=./knowledge
LOAD_DOCS_ON_STARTUP=true
CTX_KNOWLEDGE_ENABLED=true
KNOWLEDGE_RETRIEVAL_ENABLED=true
USE_KNOWLEDGE_IN_RESPONSES=true

# Server configuration
SERVER_PORT=3000
LOG_LEVEL=info
```

**Note**: WordPress and Telegram settings are optional and only needed if you're integrating with those platforms. See the WordPress Integration section at the bottom of this README for those settings.

### Step 4: Build the Project

```bash
npm run build
```

Or with bun:
```bash
bun run build
```

### Step 5: Start the Local Server

Development mode (with hot-reloading, recommended for local testing):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

### Step 6: Test the Application

Once the server is running, you can interact with Alice through:

1. **ElizaOS CLI** (recommended for local testing)
   - The CLI will start automatically with `npm run dev`
   - Type your queries directly in the terminal

2. **Telegram Bot** (if configured)
   - Add your bot token to `.env`
   - Message your bot on Telegram

3. **Direct API Calls**
   - Server runs on `http://localhost:3000` by default
   - Use tools like Postman or curl to test endpoints

Try these example queries:
- "Tell me about Pulaski County"
- "What is the ALICE threshold?"
- "Compare Benton County and Washington County"

## Getting API Keys

### OpenRouter API Key
1. Visit [openrouter.ai](https://openrouter.ai/)
2. Sign up for an account
3. Navigate to API Keys section
4. Create a new API key
5. Add to your `.env` file as `OPENROUTER_API_KEY`

### OpenAI API Key
1. Visit [platform.openai.com](https://platform.openai.com/)
2. Sign up or log in
3. Go to API Keys section
4. Create a new secret key
5. Add to your `.env` file as `OPENAI_API_KEY`

## Data Files

The project includes CSV data files in the `data/` directory:

- `counties.csv` - County-level ALICE statistics
- `subcounty.csv` - City, town, and township data
- `statewide.csv` - Arkansas-wide statistics
- `demographics.csv` - Demographic breakdowns
- `employment.csv` - Employment sector data
- `trends.csv` - Historical trend data

These files are loaded automatically on startup.

## Development

### Development Commands

```bash
# Start with hot-reloading (recommended)
npm run dev

# Build the project
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Format code
npm run format

# Run tests
npm test
```

### Project Structure

```
my-agent/
├── data/                    # CSV data files
│   ├── counties.csv
│   ├── subcounty.csv
│   ├── statewide.csv
│   ├── demographics.csv
│   ├── employment.csv
│   └── trends.csv
├── knowledge/               # Knowledge base documents
│   └── info.md
├── src/
│   ├── character.ts        # Character configuration
│   ├── index.ts           # Main entry point
│   ├── plugins/
│   │   └── csv-analysis/  # CSV data plugin
│   │       ├── actions/   # Data retrieval actions
│   │       ├── services/  # CSV data service
│   │       └── index.ts
│   └── services/
│       └── chatApiService.ts  # WordPress integration
├── .env                    # Environment variables
├── package.json
└── README.md
```

## Testing

ElizaOS employs a dual testing strategy:

1. **Component Tests** (`src/__tests__/*.test.ts`)

   - Run with Bun's native test runner
   - Fast, isolated tests using mocks
   - Perfect for TDD and component logic

2. **E2E Tests** (`src/__tests__/e2e/*.e2e.ts`)
   - Run with ElizaOS custom test runner
   - Real runtime with actual database (PGLite)
   - Test complete user scenarios

### Test Structure

```
src/
  __tests__/              # All tests live inside src
    *.test.ts            # Component tests (use Bun test runner)
    e2e/                 # E2E tests (use ElizaOS test runner)
      project-starter.e2e.ts  # E2E test suite
      README.md          # E2E testing documentation
  index.ts               # Export tests here: tests: [ProjectStarterTestSuite]
```

### Running Tests

- `elizaos test` - Run all tests (component + e2e)
- `elizaos test component` - Run only component tests
- `elizaos test e2e` - Run only E2E tests

### Writing Tests

Component tests use bun:test:

```typescript
// Unit test example (__tests__/config.test.ts)
describe('Configuration', () => {
  it('should load configuration correctly', () => {
    expect(config.debug).toBeDefined();
  });
});

// Integration test example (__tests__/integration.test.ts)
describe('Integration: Plugin with Character', () => {
  it('should initialize character with plugins', async () => {
    // Test interactions between components
  });
});
```

E2E tests use ElizaOS test interface:

```typescript
// E2E test example (e2e/project.test.ts)
export class ProjectTestSuite implements TestSuite {
  name = 'project_test_suite';
  tests = [
    {
      name: 'project_initialization',
      fn: async (runtime) => {
        // Test project in a real runtime
      },
    },
  ];
}

export default new ProjectTestSuite();
```

The test utilities in `__tests__/utils/` provide helper functions to simplify writing tests.

## Configuration

### Character Customization

Edit `src/character.ts` to customize:
- Character name and bio
- Personality traits
- Response style
- Plugin configuration

### Adding New Data

1. Add CSV files to `data/` directory
2. Update `src/plugins/csv-analysis/services/csvDataService.ts` to load new data
3. Create new actions in `src/plugins/csv-analysis/actions/`
4. Register actions in `src/plugins/csv-analysis/index.ts`


## Deployment

### Deploy to Railway

1. Create a Railway account at [railway.app](https://railway.app/)
2. Install Railway CLI: `npm install -g @railway/cli`
3. Login: `railway login`
4. Initialize: `railway init`
5. Add environment variables in Railway dashboard
6. Deploy: `railway up`

### Environment Variables for Production

Ensure all required environment variables are set in your deployment platform:
- `OPENROUTER_API_KEY`
- `OPENAI_API_KEY`
- `TEXT_MODEL`
- `TEXT_EMBEDDING_MODEL`
- `KNOWLEDGE_PATH=./knowledge`
- `LOAD_DOCS_ON_STARTUP=true`
- `CTX_KNOWLEDGE_ENABLED=true`

## Usage Examples

### County Queries
```
User: "Tell me about Pulaski County"
User: "What's the ALICE rate in Benton?"
User: "Show me data for zip code 72701"
```

### Comparisons
```
User: "Compare Benton County and Pulaski County"
User: "What's the difference between Washington and Sebastian counties?"
```

### Demographics
```
User: "What's the ALICE rate for Black households in Arkansas?"
User: "Show me Hispanic household data"
```

### Conceptual Questions
```
User: "What is the ALICE threshold?"
User: "How is ALICE calculated?"
User: "What does ALICE stand for?"
```

## Troubleshooting

### Common Issues

**Issue**: Build fails with TypeScript errors
- **Solution**: Run `npm install` to ensure all dependencies are installed
- Check that Node.js version is 18 or higher

**Issue**: "Cannot find module" errors
- **Solution**: Run `npm run build` to compile TypeScript
- Check that all imports are correct

**Issue**: API keys not working
- **Solution**: Verify `.env` file exists and has correct keys
- Ensure no extra spaces in `.env` values
- Restart the server after changing `.env`

**Issue**: CSV data not loading
- **Solution**: Check that CSV files exist in `data/` directory
- Verify CSV file format matches expected schema
- Check console logs for parsing errors

## Support

For questions or issues:
1. Check the troubleshooting section above
2. Review ElizaOS documentation at [docs.eliza.ai](https://docs.eliza.ai/)
3. Contact the development team

## WordPress Integration (Optional)

If you want to add Alice to a WordPress website using a chat widget, follow these additional steps:

### Prerequisites for WordPress Integration

1. **Deploy the ElizaOS server** to a public hosting service (Railway, Heroku, etc.)
2. **WordPress website** with admin access
3. **WordPress plugin files** (contact your admin for the Alice chat widget plugin)

### WordPress Setup Steps

#### 1. Deploy Your ElizaOS Server

First, deploy the server to a platform like Railway:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize your project
railway init

# Deploy
railway up
```

After deployment, note your public URL (e.g., `https://your-app.railway.app`)

#### 2. Configure WordPress Environment Variables

Add these variables to your deployed server's environment (in Railway dashboard or your hosting platform):

```bash
# WordPress API integration
WORDPRESS_API_URL=https://your-wordpress-site.com
WORDPRESS_API_SECRET=your_secret_key_here

# Optional: Telegram integration
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

**Important**: Generate a strong secret key for `WORDPRESS_API_SECRET`. This will be used to authenticate requests between WordPress and your ElizaOS server.

#### 3. Install the WordPress Plugin

1. Download the Alice chat widget plugin files
2. In WordPress admin, go to **Plugins → Add New → Upload Plugin**
3. Upload the plugin ZIP file
4. Activate the plugin

#### 4. Configure the Plugin

1. Go to **Settings → Alice Chat Widget**
2. Enter your configuration:
   - **API URL**: Your deployed ElizaOS server URL (e.g., `https://your-app.railway.app`)
   - **API Secret**: The same secret key you set in `WORDPRESS_API_SECRET`
   - **Widget Position**: Choose where the chat icon appears
   - **Custom Styling**: Optional CSS customization
3. Save settings

#### 5. Test the Integration

1. Visit your WordPress site (logged out to see the public view)
2. Look for the chat widget icon (usually bottom right)
3. Click to open and try queries:
   - "What is the ALICE threshold?"
   - "Tell me about Pulaski County"
   - "Compare Benton and Washington counties"

### WordPress Integration Troubleshooting

**Issue**: Chat widget not appearing
- Verify plugin is activated
- Check browser console for JavaScript errors
- Ensure API URL is correct (no trailing slash)

**Issue**: "Connection failed" or "Unable to connect" errors
- Verify your ElizaOS server is running and accessible
- Check `WORDPRESS_API_SECRET` matches in both .env and WordPress settings
- Ensure CORS is enabled on your server for your WordPress domain

**Issue**: Responses are slow or timing out
- Check your hosting plan limits (Railway free tier has restrictions)
- Verify OpenRouter/OpenAI API keys have sufficient credits
- Check server logs for errors

### Security Notes for WordPress Integration

- **Never commit** your `WORDPRESS_API_SECRET` to version control
- Use environment variables for all sensitive data
- Implement rate limiting if you expect high traffic
- Regularly rotate your API secret
- Monitor API usage to prevent abuse

## License

This project is built on ElizaOS. See LICENSE file for details.
