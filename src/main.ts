import MegaverseAPI, { type SoloonColor, type ComethDirection, type PolyanetEntity, type SoloonEntity, type ComethEntity } from './api.js';

// Add delay function to handle rate limiting
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Phase 1 function (currently unused but kept for reference)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function createPhase1XShape(api: MegaverseAPI): Promise<void> {
  console.log('Creating Phase 1 X-shape...');
  
  const coordinates = [];
  for (let i = 2; i <= 8; i++) {
    coordinates.push([i, i]); // Main diagonal: (2,2), (3,3), ..., (8,8)
    coordinates.push([i, 10 - i]); // Anti-diagonal: (2,8), (3,7), ..., (8,2)
  }

  for (const [row, column] of coordinates) {
    const response = await api.createPolyanet({ row, column });
    console.log(`Creating Polyanet at (${row}, ${column}): ${response.message}`);
    if (!response.success) {
      console.error(`Failed to create Polyanet at (${row}, ${column}): ${response.message}`);
    }
  }

  const validateResponse = await api.validateMap();
  console.log(`Validation result: ${validateResponse.message}`);
  if (validateResponse.success && validateResponse.data?.solved) {
    console.log('Phase 1 completed successfully!');
  } else {
    console.error('Phase 1 validation failed:', validateResponse.data || validateResponse.message);
  }
}

async function createPhase2Logo(api: MegaverseAPI): Promise<void> {
  console.log('Creating Phase 2 Crossmint logo...');

  const goalResponse = await api.getGoalMap();
  if (!goalResponse.success || !goalResponse.data) {
    console.error('Failed to fetch goal map:', goalResponse.message);
    return;
  }

  console.log('Goal response data:', JSON.stringify(goalResponse.data, null, 2));

  const goalMap = goalResponse.data.goal as Array<Array<unknown>>;
  if (!Array.isArray(goalMap)) {
    console.error('Invalid goal map format');
    return;
  }

  console.log('Goal map dimensions:', goalMap.length, 'x', goalMap[0]?.length);
  console.log('First few rows of goal map:', goalMap.slice(0, 3));

  // Collect all entities to create
  const polyanets: PolyanetEntity[] = [];
  const soloons: SoloonEntity[] = [];
  const comeths: ComethEntity[] = [];
  
  for (let row = 0; row < goalMap.length; row++) {
    for (let column = 0; column < goalMap[row].length; column++) {
      const cell = goalMap[row][column];
      
      if (cell && typeof cell === 'string' && cell !== 'SPACE') {
        if (cell === 'POLYANET') {
          polyanets.push({ row, column });
        } else if (cell.endsWith('_SOLOON')) {
          const color = cell.replace('_SOLOON', '').toLowerCase() as SoloonColor;
          soloons.push({ row, column, color });
        } else if (cell.endsWith('_COMETH')) {
          const direction = cell.replace('_COMETH', '').toLowerCase() as ComethDirection;
          comeths.push({ row, column, direction });
        }
      }
    }
  }

  const totalEntities = polyanets.length + soloons.length + comeths.length;
  console.log(`Found ${totalEntities} entities: ${polyanets.length} Polyanets, ${soloons.length} Soloons, ${comeths.length} Comeths`);

  // Combine all entities for batch processing
  const allEntities = [
    ...polyanets.map(entity => ({ entity, createFn: () => api.createPolyanet(entity), type: 'POLYANET' })),
    ...soloons.map(entity => ({ entity, createFn: () => api.createSoloon(entity), type: `${entity.color.toUpperCase()}_SOLOON` })),
    ...comeths.map(entity => ({ entity, createFn: () => api.createCometh(entity), type: `${entity.direction.toUpperCase()}_COMETH` }))
  ];

  // Process entities in parallel batches to respect rate limits
  const batchSize = 5; // Adjust based on API rate limits
  const batches = [];
  
  for (let i = 0; i < allEntities.length; i += batchSize) {
    batches.push(allEntities.slice(i, i + batchSize));
  }

  console.log(`Processing ${batches.length} batches of ${batchSize} entities each`);

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(`Processing batch ${batchIndex + 1}/${batches.length}...`);
    
    // Process all entities in the current batch in parallel
    const promises = batch.map(async ({ entity, createFn, type }) => {
      try {
        const response = await createFn();
        
        if (response.success) {
          console.log(`Created ${type} at (${entity.row}, ${entity.column})`);
        } else {
          console.error(`Failed to create ${type} at (${entity.row}, ${entity.column}): ${response.message}`);
        }
        
        return response;
      } catch (error) {
        console.error(`Error creating entity at (${entity.row}, ${entity.column}):`, error);
        return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
      }
    });

    // Wait for all requests in the batch to complete
    await Promise.all(promises);
    
    // Add delay between batches to respect rate limits
    if (batchIndex < batches.length - 1) {
      console.log('Waiting before next batch...');
      await delay(2000); // 2 second delay between batches
    }
  }

  const validateResponse = await api.validateMap();
  console.log(`Validation result: ${validateResponse.message}`);
  if (validateResponse.success && validateResponse.data?.solved) {
    console.log('Phase 2 completed successfully!');
  } else {
    console.error('Phase 2 validation failed:', validateResponse.data || validateResponse.message);
  }
}

async function main() {
  const candidateId = '9ae160b2-d740-4335-ac93-c4e73eb44205';
  const api = new MegaverseAPI(candidateId);

  try {
    // Run Phase 1
    // await createPhase1XShape(api);
    // Uncomment for Phase 2 after Phase 1 is validated
    await createPhase2Logo(api);
  } catch (error) {
    console.error('Error during execution:', error instanceof Error ? error.message : 'Unknown error');
  }
}

// ES module equivalent of require.main === module check
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}