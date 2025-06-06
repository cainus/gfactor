# GFactor - AI-Powered Code Migration Tool

GFactor is a VSCode extension that helps with large codebase migrations from one pattern to another. It leverages AI (Google Gemini or Anthropic Claude) to intelligently refactor code while ensuring tests and linting pass.

## Features

- AI-powered code migration and refactoring
- Support for both Google Gemini and Anthropic Claude
- Contextual understanding from .mdc files
- Interactive form for configuring refactoring parameters
- Automatic testing and linting to ensure code quality
- Configurable stopping points (after each fix, file, or only when complete)
- Burndown chart visualization to track pattern elimination progress

## Requirements

- Visual Studio Code 1.100.0 or higher
- Node.js 18.18.0 or higher (specified in .nvmrc)
- An API key for either Google Gemini or Anthropic Claude

> **Note**: This project uses an `.nvmrc` file to specify the required Node.js version. If you use nvm (Node Version Manager), you can simply run `nvm use` in the project directory to switch to the correct Node.js version.

## Building and Installing Locally

### 1. Clone the Repository

```bash
git clone https://github.com/cainus/gfactor.git
cd gfactor
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Extension

```bash
npm run compile
```

### 4. Package the Extension

```bash
npm run package
```

This will create a `.vsix` file in the project directory.

### 5. Install the Extension in VS Code

- Open VS Code
- Go to the Extensions view (Ctrl+Shift+X)
- Click on the "..." menu in the top-right of the Extensions view
- Select "Install from VSIX..."
- Navigate to and select the `.vsix` file created in the previous step

### Alternative: Run in Development Mode

You can also run the extension directly in development mode:

1. Open the project in VS Code:
   ```bash
   code .
   ```

2. Press F5 to start debugging, which will launch a new VS Code window with the extension loaded.

## Usage

1. After installing the extension, you'll need to configure your API keys:
   - Open the Command Palette (Ctrl+Shift+P)
   - Type and select "GFactor: Configure API Keys"
   - Choose which LLM you want to use (Gemini or Claude)
   - Enter your API key when prompted

2. Open a project in VS Code that you want to refactor.

3. Open the Command Palette (Ctrl+Shift+P) and select "GFactor: Start Code Migration".

4. Fill out the refactoring form:
   - **How to run the compiler/linter**: Command to run your project's linter (e.g., `npm run lint`)
   - **How to run the tests**: Command to run your project's tests (e.g., `npm test`)
   - **What file patterns to investigate**: Glob pattern for files to refactor (e.g., `src/**/*.ts`)
   - **How to find the pattern to migrate away from**: Description or example of the pattern to replace
   - **How to fix or replace the pattern**: Description or example of the replacement pattern
   - **Stop option**: Choose when to pause for review (after each fix, after each file, or only when complete)

5. Click "Run" to start the refactoring process.

6. GFactor will:
   - Find files matching your pattern
   - Use AI to identify and refactor the specified patterns
   - Run linting and tests to ensure code quality
   - Stop at your configured points for review
   - Show a burndown chart to visualize pattern elimination progress

## Using .mdc Files for Context

GFactor reads all `.mdc` (Markdown Context) files in your project to provide additional context to the AI. These files can contain:

- Project-specific information
- Architectural guidelines
- Coding standards
- Migration rules and examples

Place `.mdc` files throughout your project to provide context relevant to specific directories or components.

## Burndown Chart

GFactor includes a burndown chart feature that visualizes the reduction of old patterns during refactoring. This helps you track progress and understand how effectively patterns are being eliminated.

To view the burndown chart:
- Use the command "GFactor: Show Pattern Burndown Chart" at any time
- Click "Show Burndown Chart" when prompted after refactoring is complete
- Select "Show Burndown Chart" when prompted after each file (if using the "Stop after each file" option)

The chart displays:
- A line graph showing the number of patterns remaining over time
- A data table with details about each refactoring step
- Information about which files were processed at each step

## License

MIT