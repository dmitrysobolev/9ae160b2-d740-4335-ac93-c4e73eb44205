import MegaverseAPI, { type SoloonColor, type ComethDirection, type PolyanetEntity, type SoloonEntity, type ComethEntity } from './api.js';
import pLimit from 'p-limit';

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

  const goalMap = goalResponse.data.goal as string[][];
  if (!Array.isArray(goalMap)) {
    console.error('Invalid goal map format');
    return;
  }

  console.log('Goal map dimensions:', goalMap.length, 'x', goalMap[0]?.length);
  console.log('First few rows of goal map:', goalMap.slice(0, 3));

  const entities: (PolyanetEntity | SoloonEntity | ComethEntity)[] = [];
  
  for (let row = 0; row < goalMap.length; row++) {
    for (let column = 0; column < goalMap[row].length; column++) {
      const cell = goalMap[row][column];
      
      if (cell && typeof cell === 'string' && cell !== 'SPACE') {
        if (cell === 'POLYANET') {
          entities.push({ row, column } as PolyanetEntity);
        } else if (cell.endsWith('_SOLOON')) {
          const color = cell.replace('_SOLOON', '').toLowerCase() as SoloonColor;
          entities.push({ row, column, color } as SoloonEntity);
        } else if (cell.endsWith('_COMETH')) {
          const direction = cell.replace('_COMETH', '').toLowerCase() as ComethDirection;
          entities.push({ row, column, direction } as ComethEntity);
        }
      }
    }
  }

  const createEntity = (entity: PolyanetEntity | SoloonEntity | ComethEntity) => {
    if ('color' in entity) {
      return { createFn: () => api.createSoloon(entity), displayName: `${entity.color.toUpperCase()}_SOLOON` };
    }
    if ('direction' in entity) {
      return { createFn: () => api.createCometh(entity), displayName: `${entity.direction.toUpperCase()}_COMETH` };
    }
    return { createFn: () => api.createPolyanet(entity), displayName: 'POLYANET' };
  };

  // Create concurrency limiter (max 2 concurrent requests)
  const limit = pLimit(2);
  
  console.log(`Processing ${entities.length} entities with max 2 concurrent requests...`);

  // Process all entities with concurrency control
  const results = await Promise.allSettled(
    entities.map((entity, i) =>
      limit(async () => {
        const { createFn, displayName } = createEntity(entity);
        
        try {
          const response = await createFn();
          
          if (response.success) {
            console.log(`Created ${displayName} at (${entity.row}, ${entity.column}) [${i + 1}/${entities.length}]`);
          } else {
            console.error(`Failed to create ${displayName} at (${entity.row}, ${entity.column}): ${response.message}`);
          }
          
          return response;
        } catch (error) {
          console.error(`Error creating ${displayName} at (${entity.row}, ${entity.column}):`, error);
          return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
        }
      })
    )
  );

  // Summary of results
  const successful = results.filter(result => 
    result.status === 'fulfilled' && result.value.success
  ).length;
  const failed = entities.length - successful;
  
  console.log(`\nCompleted: ${successful} successful, ${failed} failed out of ${entities.length} entities`);

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