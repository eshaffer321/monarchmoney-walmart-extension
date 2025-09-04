/**
 * Integration test demonstrating the auth status bug
 * 
 * BUG: When CHECK_AUTH message is sent and authentication succeeds,
 * the sync status remains as CHECKING_AUTH instead of being reset to IDLE.
 * This causes the popup to show "Checking Auth" even when already authenticated.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SYNC_STATUS, STORAGE_KEYS } from "../../shared";

describe("Auth Status Bug - Reproduction", () => {
  
  // Simulate the background script's handleCheckAuth behavior
  const simulateHandleCheckAuth = async (storageAdapter: any, authService: any) => {
    // Step 1: Set status to CHECKING_AUTH (this is what happens in background.ts line 116)
    await storageAdapter.set({
      [STORAGE_KEYS.SYNC_STATUS]: {
        status: SYNC_STATUS.CHECKING_AUTH,
        timestamp: new Date().toISOString()
      }
    });
    
    // Step 2: Check authentication
    const authResult = await authService.checkAuth();
    
    // Step 3: Store auth result
    await storageAdapter.set({ 
      [STORAGE_KEYS.AUTH_STATUS]: authResult 
    });
    
    // Step 4: Handle result
    if (!authResult.authenticated) {
      // Error case - this works correctly
      await storageAdapter.set({
        [STORAGE_KEYS.SYNC_STATUS]: {
          status: SYNC_STATUS.ERROR,
          details: { message: authResult.message },
          timestamp: new Date().toISOString()
        }
      });
    } else {
      // BUG: Success case - status is NOT reset to IDLE
      // The following line is MISSING in the actual code:
      // await storageAdapter.set({
      //   [STORAGE_KEYS.SYNC_STATUS]: {
      //     status: SYNC_STATUS.IDLE,
      //     timestamp: new Date().toISOString()
      //   }
      // });
    }
    
    return authResult;
  };

  describe("Current Buggy Behavior", () => {
    it("demonstrates that CHECKING_AUTH status persists after successful authentication", async () => {
      // Mock storage
      const storedData: Record<string, any> = {};
      const storageAdapter = {
        set: vi.fn(async (data) => {
          Object.assign(storedData, data);
        }),
        get: vi.fn(async () => storedData)
      };
      
      // Mock auth service - successful auth
      const authService = {
        checkAuth: vi.fn().mockResolvedValue({
          authenticated: true,
          message: "Authenticated"
        })
      };
      
      // Simulate the auth check
      await simulateHandleCheckAuth(storageAdapter, authService);
      
      // Check what's in storage after successful auth
      const finalSyncStatus = storedData[STORAGE_KEYS.SYNC_STATUS];
      const finalAuthStatus = storedData[STORAGE_KEYS.AUTH_STATUS];
      
      console.log("\n=== Bug Demonstration ===");
      console.log("After successful authentication:");
      console.log("  Auth Status:", finalAuthStatus);
      console.log("  Sync Status:", finalSyncStatus);
      console.log("  Problem: Sync status is still CHECKING_AUTH!");
      
      // This assertion shows the BUG
      expect(finalSyncStatus.status).toBe(SYNC_STATUS.CHECKING_AUTH);
      expect(finalAuthStatus.authenticated).toBe(true);
      
      // This is what the popup sees:
      // - authStatus.authenticated = true (user IS logged in)
      // - syncStatus.status = "checking_auth" (but UI shows "Checking Auth")
    });
    
    it("shows what the popup receives when calling GET_STATUS", async () => {
      // Setup storage with the buggy state
      const storedData = {
        [STORAGE_KEYS.AUTH_STATUS]: {
          authenticated: true,
          message: "Authenticated"
        },
        [STORAGE_KEYS.SYNC_STATUS]: {
          status: SYNC_STATUS.CHECKING_AUTH,
          timestamp: new Date().toISOString()
        }
      };
      
      // Simulate GET_STATUS response
      const getStatusResponse = {
        authStatus: storedData[STORAGE_KEYS.AUTH_STATUS],
        syncStatus: storedData[STORAGE_KEYS.SYNC_STATUS],
        lastSync: null,
        processedOrderCount: 0
      };
      
      console.log("\n=== What Popup Receives ===");
      console.log("GET_STATUS response:", JSON.stringify(getStatusResponse, null, 2));
      console.log("Result: Shows 'Logged in to Walmart' at top but 'Checking Auth' in status!");
      
      // The confusing state that causes the UI issue
      expect(getStatusResponse.authStatus.authenticated).toBe(true);
      expect(getStatusResponse.syncStatus.status).toBe(SYNC_STATUS.CHECKING_AUTH);
    });
  });
  
  describe("Expected Correct Behavior", () => {
    it("should reset status to IDLE after successful authentication", async () => {
      // This test shows what SHOULD happen
      const storedData: Record<string, any> = {};
      const storageAdapter = {
        set: vi.fn(async (data) => {
          Object.assign(storedData, data);
        })
      };
      
      const authService = {
        checkAuth: vi.fn().mockResolvedValue({
          authenticated: true,
          message: "Authenticated"
        })
      };
      
      // Correct implementation would be:
      const correctHandleCheckAuth = async () => {
        await storageAdapter.set({
          [STORAGE_KEYS.SYNC_STATUS]: {
            status: SYNC_STATUS.CHECKING_AUTH,
            timestamp: new Date().toISOString()
          }
        });
        
        const authResult = await authService.checkAuth();
        
        await storageAdapter.set({ 
          [STORAGE_KEYS.AUTH_STATUS]: authResult 
        });
        
        if (!authResult.authenticated) {
          await storageAdapter.set({
            [STORAGE_KEYS.SYNC_STATUS]: {
              status: SYNC_STATUS.ERROR,
              details: { message: authResult.message },
              timestamp: new Date().toISOString()
            }
          });
        } else {
          // FIX: Reset to IDLE on success
          await storageAdapter.set({
            [STORAGE_KEYS.SYNC_STATUS]: {
              status: SYNC_STATUS.IDLE,
              timestamp: new Date().toISOString()
            }
          });
        }
        
        return authResult;
      };
      
      await correctHandleCheckAuth();
      
      const finalSyncStatus = storedData[STORAGE_KEYS.SYNC_STATUS];
      
      console.log("\n=== Expected Behavior ===");
      console.log("After successful auth, sync status should be:", SYNC_STATUS.IDLE);
      console.log("Actual sync status would be:", finalSyncStatus.status);
      
      // This is what we WANT to happen
      expect(finalSyncStatus.status).toBe(SYNC_STATUS.IDLE);
    });
  });
  
  describe("Error Case (Works Correctly)", () => {
    it("correctly sets ERROR status when authentication fails", async () => {
      const storedData: Record<string, any> = {};
      const storageAdapter = {
        set: vi.fn(async (data) => {
          Object.assign(storedData, data);
        })
      };
      
      const authService = {
        checkAuth: vi.fn().mockResolvedValue({
          authenticated: false,
          message: "Not logged in"
        })
      };
      
      await simulateHandleCheckAuth(storageAdapter, authService);
      
      const finalSyncStatus = storedData[STORAGE_KEYS.SYNC_STATUS];
      
      // Error case is handled correctly
      expect(finalSyncStatus.status).toBe(SYNC_STATUS.ERROR);
      expect(finalSyncStatus.details.message).toBe("Not logged in");
    });
  });
});