/**
 * Script to test task deletion functionality
 * Usage: node test-delete.js <taskId> <token>
 */

const fetch = require('node-fetch');

// Get task ID and token from command line arguments
const taskId = process.argv[2];
const token = process.argv[3];

if (!taskId || !token) {
  console.error('Please provide task ID and token parameters');
  console.error('Usage: node test-delete.js <taskId> <token>');
  process.exit(1);
}

// Test task deletion functionality
async function testDeleteTask() {
  try {
    console.log(`Attempting to delete task ID: ${taskId}`);
    console.log(`Using token: ${token.substring(0, 10)}...`);
    
    const response = await fetch(`http://localhost:5001/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      }
    });
    
    const responseData = await response.text();
    console.log(`Status code: ${response.status}`);
    console.log(`Response headers: ${JSON.stringify(response.headers.raw(), null, 2)}`);
    
    try {
      const jsonData = JSON.parse(responseData);
      console.log(`Response data: ${JSON.stringify(jsonData, null, 2)}`);
    } catch (e) {
      console.log(`Response content: ${responseData}`);
    }
    
    if (response.ok) {
      console.log('Task deletion successful');
    } else {
      console.log('Task deletion failed');
    }
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Execute test
testDeleteTask(); 