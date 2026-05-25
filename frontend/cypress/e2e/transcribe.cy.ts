describe('Enterprise Transcriber E2E Workspace', () => {
  const mockHistory = [
    {
      id: 'recording-1',
      title: 'Previous Meeting.mp3',
      status: 'completed',
      duration: 120000,
      wordsCount: 150,
      createdAt: '2026-05-22T10:00:00Z',
      updatedAt: '2026-05-22T10:05:00Z',
    },
  ];

  const completedRecord = {
    id: 'recording-1',
    title: 'Previous Meeting.mp3',
    status: 'completed',
    duration: 120000,
    wordsCount: 150,
    createdAt: '2026-05-22T10:00:00Z',
    updatedAt: '2026-05-22T10:05:00Z',
    utterances: [
      {
        speaker: 'A',
        text: 'Welcome everyone to our weekly project sync up.',
        start: 0,
        end: 5000,
      },
      {
        speaker: 'B',
        text: 'Thanks Alice, let us look at the new frontend tests.',
        start: 6000,
        end: 11000,
      },
    ],
    summary: 'Alice welcomed everyone to the project sync and discussed testing.',
    chapters: [
      {
        start: 0,
        end: 5000,
        headline: 'Welcome',
        gist: 'Alice greets the team',
        summary: 'Introductions and greeting.',
      },
    ],
    speakerNames: {
      A: 'Alice',
    },
  };

  beforeEach(() => {
    // Intercept backend requests to keep E2E specs fast and deterministic
    cy.intercept('GET', 'http://localhost:3001/setup/status', { hasApiKey: true }).as('getSetupStatus');
    cy.intercept('GET', 'http://localhost:3001/transcribe/history', mockHistory).as('getHistory');
    cy.intercept('GET', 'http://localhost:3001/transcribe/status/recording-1', completedRecord).as('getRecordStatus');
  });

  it('performs full onboarding when no API Key is active', () => {
    // Override the setup status intercept to return hasApiKey: false
    cy.intercept('GET', 'http://localhost:3001/setup/status', { hasApiKey: false }).as('getNoApiKey');
    cy.intercept('POST', 'http://localhost:3001/setup/config', { success: true }).as('configureApiKey');

    cy.visit('/');

    // Check onboarding screen renders correctly
    cy.contains('Welcome to Transcribe').should('be.visible');
    cy.contains('Enter your AssemblyAI API Key to start transcribing').should('be.visible');

    // Trigger validation
    cy.get('button').contains('Activate Application').click();
    cy.contains('API key cannot be empty').should('be.visible');

    // Input active API key
    cy.get('input[type="password"]').type('assembly_api_key_valid_secret');
    
    // Setup status should now return true after configuration
    cy.intercept('GET', 'http://localhost:3001/setup/status', { hasApiKey: true }).as('getSetupStatusAfter');
    cy.get('button').contains('Activate Application').click();

    // Verify it transitioned to the main empty dashboard dashboard
    cy.contains('Transcribe New Media').should('be.visible');
    cy.contains('Previous Meeting.mp3').should('be.visible'); // History list sidebar should load
  });

  it('navigates history sidebar records and displays interactive workspace', () => {
    cy.visit('/');

    // Verify history record is in the sidebar
    cy.contains('Previous Meeting.mp3').should('be.visible');
    
    // Click on history record to open workspace
    cy.get('[class*="HistoryItem"]').first().click();

    // Wait for the record details to be fetched
    cy.wait('@getRecordStatus');

    // Verify Action Bar details are visible
    cy.contains('Previous Meeting.mp3').should('be.visible');
    cy.contains('150 words').should('be.visible');

    // Verify speakers and texts rendered in chat bubbles
    cy.contains('Alice').should('be.visible');
    cy.contains('Speaker B').should('be.visible');
    cy.contains('Welcome everyone to our weekly project sync up.').should('be.visible');
    cy.contains('Thanks Alice, let us look at the new frontend tests.').should('be.visible');

    // Verify AI Summary tab content
    cy.contains('Executive Summary').should('be.visible');
    cy.contains('Alice welcomed everyone to the project sync').should('be.visible');
  });

  it('toggles tabs and highlights seek locations inside workspace', () => {
    cy.visit('/');
    cy.get('[class*="HistoryItem"]').first().click();
    cy.wait('@getRecordStatus');

    // Switch to Chapters tab
    cy.get('[role="tab"]').contains('Chapters').click();
    cy.contains('Chapters Index').should('be.visible');
    cy.contains('Alice greets the team').should('be.visible');

    // Clicking chapter items should seek audio
    cy.contains('Welcome').click();

    // Searching transcript highlights matches
    cy.get('input[placeholder="Search transcript..."]').type('weekly');
    cy.get('span').contains('weekly').should('have.css', 'background-color').and('contain', 'rgba(234, 179, 8');
  });

  it('renames speaker names across all utterances dynamically', () => {
    const renamedRecord = {
      ...completedRecord,
      speakerNames: {
        A: 'Alice',
        B: 'Bob',
      },
    };

    cy.intercept('POST', 'http://localhost:3001/transcribe/rename-speaker', renamedRecord).as('renameSpeaker');

    cy.visit('/');
    cy.get('[class*="HistoryItem"]').first().click();
    cy.wait('@getRecordStatus');

    // Find the edit speaker icon next to Speaker B and click it
    cy.get('button').find('[data-testid="EditIcon"]').eq(1).click({ force: true });

    // Validate edit dialog
    cy.contains('Rename Speaker B').should('be.visible');
    cy.get('input[placeholder="Type actual name..."]').clear().type('Bob');
    
    cy.get('button').contains('Save Changes').click();
    cy.wait('@renameSpeaker');

    // Verify changed name is rendered everywhere in workspace
    cy.contains('Bob').should('be.visible');
  });
});
