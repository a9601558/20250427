# Navigator.sendBeacon Implementation for Quiz Progress Synchronization

This document explains the implementation of the `navigator.sendBeacon` API for reliable quiz progress synchronization, especially during page unload events.

## Overview

The standard socket.io-based synchronization mechanism works well during normal application operation but can be unreliable when the user is navigating away from the page or closing the browser. The `navigator.sendBeacon` API provides a more reliable way to send data to the server during these events.

## Implementation Details

### Client-Side Implementation

The `useQuizProgress` hook has been enhanced with the following features:

1. **Callback-based socket confirmations** - The socket.emit calls now use callbacks to confirm that the server has received and processed the data
2. **Beacon API for page unload** - A new `forceSyncWithBeacon` function uses `navigator.sendBeacon` to send data during page unload events
3. **Multi-layered sync strategy** - The hook attempts to sync using both socket.io and the Beacon API during unmounting and page unload
4. **Fallback mechanisms** - If both sync methods fail, the data is marked with `pendingSync: true` in localStorage for sync on next load

```javascript
// Key implementation in useQuizProgress.ts
const forceSyncWithBeacon = useCallback(() => {
  if (!userId || !questionSetId || !pendingBeaconDataRef.current) {
    return false;
  }
  
  try {
    if ('sendBeacon' in navigator) {
      const endpoint = `/api/progress/sync`;
      
      return navigator.sendBeacon(
        endpoint,
        JSON.stringify(pendingBeaconDataRef.current)
      );
    }
  } catch (e) {
    console.error('[useQuizProgress] sendBeacon failed:', e);
  }
  
  return false;
}, [userId, questionSetId]);
```

### Server-Side Implementation

The server has been enhanced with:

1. **Dedicated HTTP endpoint** - A new `/api/progress/sync` endpoint specifically handles Beacon API requests
2. **Content-type handling** - The endpoint can process different content types that browsers might use with sendBeacon
3. **Success-oriented responses** - Even on error, the endpoint returns HTTP 200 to avoid browser warnings
4. **Data format consistency** - The endpoint processes data in the same way as the socket handler

```javascript
// Key implementation in userProgressController.ts
export const syncProgressViaBeacon = async (req: Request, res: Response) => {
  try {
    // Parse data from various content types
    let data = parseRequestData(req);
    
    // Process progress data
    // ...
    
    // Always return 200, even on error
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error processing beacon progress update:', error);
    return res.status(200).json({
      success: false,
      message: 'Error processing update, but request received'
    });
  }
};
```

## Testing Considerations

Testing the Beacon API implementation requires special attention:

1. **Browser compatibility** - Test across different browsers as Beacon API support varies
2. **Content-type handling** - Verify that all content types are correctly processed
3. **Network conditions** - Test under poor network conditions to verify reliability
4. **During page navigation** - Test during actual navigation events and browser close
5. **Fallback mechanisms** - Verify that the localStorage fallback works when needed

## Security Considerations

The Beacon API implementation maintains the same security model as the rest of the application:

1. **Authentication** - The `/api/progress/sync` endpoint uses the same authentication middleware as other endpoints
2. **Data validation** - All incoming data is validated before processing
3. **Rate limiting** - Consider implementing rate limiting to prevent abuse

## Performance Considerations

The implementation is designed with performance in mind:

1. **Minimal processing** - The endpoint only does essential processing since response handling isn't guaranteed
2. **Efficient data storage** - Answered questions are stored in the metadata field as JSON
3. **200 status codes** - Always returning 200 prevents unnecessary browser warning logs

## Future Improvements

Potential future improvements include:

1. **Service Workers** - Leverage service workers for even more reliable offline synchronization
2. **Background Sync API** - Implement the Background Sync API for browsers that support it
3. **Analytics** - Add analytics to measure the success rate of different sync methods

## Troubleshooting

If sync issues occur:

1. Check browser console for errors
2. Verify that the server is correctly processing the Beacon requests
3. Check network traffic to confirm the request is being sent
4. Verify that localStorage fallback is working properly 