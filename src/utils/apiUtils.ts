/**
 * Helper functions for API interactions
 */

/**
 * Upload a file to the specified endpoint
 * @param endpoint - The API endpoint URL
 * @param formData - FormData object containing the file and any metadata
 * @param token - Authentication token
 * @param onProgress - Optional callback for upload progress
 */
export const uploadFile = async (
  endpoint: string,
  formData: FormData,
  token: string | null,
  onProgress?: (progress: number) => void
): Promise<Response> => {
  if (!token) {
    throw new Error('Authentication required');
  }
  
  // Create a mock progress simulation if real progress tracking isn't available
  let progressInterval: number | null = null;
  let mockProgress = 0;
  
  if (onProgress) {
    // Start with a progress value of 10%
    onProgress(10);
    
    // Simulate progress updates
    progressInterval = window.setInterval(() => {
      mockProgress += 5;
      // Cap at 90% - we'll set it to 100% when the request completes
      if (mockProgress < 90) {
        onProgress(mockProgress);
      }
    }, 500) as unknown as number;
  }
  
  try {
    console.log(`Uploading file to: ${endpoint}`);
    
    // Make the API request
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    // Clear the progress interval if it was set
    if (progressInterval !== null) {
      clearInterval(progressInterval);
    }
    
    // Set progress to 100% on completion
    if (onProgress) {
      onProgress(100);
    }
    
    return response;
  } catch (error) {
    // Clear the progress interval if it was set
    if (progressInterval !== null) {
      clearInterval(progressInterval);
    }
    
    // Set progress to 0 on error
    if (onProgress) {
      onProgress(0);
    }
    
    throw error;
  }
}; 