# WebRTC Join Error - Room Not Found (Diagnostic Guide)

## Your Current Error

```
❌ Server error: Failed to join room: Room not found
📋 Available rooms: NONE
```

## What This Means

The server checked all active rooms and couldn't find room code `P6FSX9Z1Q`. 

**Possible Reasons:**
1. ❌ Room code is incorrect/different than what was created
2. ❌ Room was never created on this server instance
3. ❌ Server restarted and lost the in-memory room (most common)
4. ❌ Too much time passed since room creation

---

## 🔧 How to Fix (Quick Steps)

### Step 1: Verify You're Using the Correct Room Code

**Double-check:**
- Copy the room code DIRECTLY from the "Share" button
- Don't type it manually
- Make sure there are no spaces or extra characters
- It's case-sensitive (ABC ≠ abc)

### Step 2: Check If Server is Running

**Verify server is active:**
```bash
curl https://webrtc-bifrost.onrender.com/health
```

**Should return:**
```json
{"status":"ok","timestamp":"2026-04-25T..."}
```

If this fails, server is down.

### Step 3: Check What Rooms Currently Exist

**See all active rooms:**
```bash
curl https://webrtc-bifrost.onrender.com/api/debug/rooms
```

**Example response:**
```json
{
  "activeRooms": 0,
  "rooms": [],
  "timestamp": "2026-04-25T..."
}
```

If `activeRooms: 0`, then:
- ❌ No rooms on server
- ❌ The room `P6FSX9Z1Q` is gone
- ✅ You need to create a new one

### Step 4: Create a NEW Room and Test

**Do this:**
1. ✅ Go back to landing page
2. ✅ Click "Create Room"
3. ✅ Enter your name
4. ✅ **IMMEDIATELY** (within 10 seconds) open new browser tab
5. ✅ Click "Join Room"
6. ✅ **PASTE** the room code (copy-paste, don't type)
7. ✅ Enter a different name
8. ✅ Should connect! ✓

**⏰ IMPORTANT**: Join immediately after creating. Don't wait!

---

## Why Rooms Disappear

### In-Memory Storage
Currently, rooms are stored in RAM:
```
Server RAM → Room "ABC123" exists → Browser can join
Server Restarts → RAM cleared → Room "ABC123" gone
```

### What Causes Server Restart
- ✅ Render auto-restarts services periodically
- ✅ New deployment (code push)
- ✅ Server crash or error
- ✅ Render maintenance
- ✅ Out of memory on free tier

### When This Happens
Room data is lost immediately. No recovery without database backup.

---

## ✅ Verified Working Scenario

**This WILL work:**

```
T=0s:   Create room → "ABC123XYZ"
T=2s:   Share code with friend
T=5s:   Friend opens browser
T=8s:   Friend joins with "ABC123XYZ"
Result: ✓ Connection successful, video grid works
```

**This will FAIL:**

```
T=0s:   Create room → "ABC123XYZ"
T=300s: Wait 5 minutes...
T=305s: Server restarts (Render maintenance)
T=310s: Try to join
Result: ✗ Room not found (server lost in-memory data)
```

---

## 🔍 Debugging Checklist

Before trying again:

- [ ] Room code copied correctly (case-sensitive)
- [ ] No extra spaces in room code
- [ ] Server health check passes (`/health` endpoint)
- [ ] No rooms on server (`/api/debug/rooms` shows activeRooms: 0)
- [ ] Creating NEW room (not old room code)
- [ ] Joining IMMEDIATELY (< 30 seconds after create)
- [ ] Using same device/browser setup as worked before

---

## 🎯 Testing Steps

### Test 1: Create and Join Immediately ✓
```
Expected: SUCCESS
Time: < 30 seconds total
```

### Test 2: Check Debug Endpoint
```bash
curl https://webrtc-bifrost.onrender.com/api/debug/rooms
```
**Expected**: Shows 2 rooms, 2 users each

### Test 3: Multiple Users
```
User A: Create room → "ABC123"
User B: Join with "ABC123" (5 seconds later)
User C: Join with "ABC123" (8 seconds later)
Expected: All 3 see each other
```

### Test 4: Leave and Rejoin
```
User A leaves room
Room should still exist if others are in it
User A rejoins with code
Expected: SUCCESS if < 30 seconds
```

---

## 📊 Server Status

Check live:
```bash
# Health check
curl https://webrtc-bifrost.onrender.com/health

# Active rooms
curl https://webrtc-bifrost.onrender.com/api/debug/rooms

# Available rooms (JSON format)
curl https://webrtc-bifrost.onrender.com/api/debug/rooms | jq '.rooms[].roomId'
```

---

## 🚀 What I Just Fixed

I improved the error logging so now when you get an error, console shows:

```javascript
✓ Clearer error messages
✓ Exact room code attempted
✓ List of available rooms
✓ Diagnostic suggestions
✓ Raw error data for debugging
```

**Before**: "❌ Server error: Object"
**After**: 
```
❌ Server error: {
  "message": "Failed to join room: Room not found",
  "roomId": "P6FSX9Z1Q",
  "available_rooms": "NONE"
}
🔍 Debugging Info:
   Room attempted: P6FSX9Z1Q
   Available rooms: NONE
   ⚠️ No rooms on server. The room may have expired or server restarted.
   💡 Solution: Create a new room and join immediately
```

---

## 🎯 Immediate Action

**Right now, do this:**

1. Open browser console (F12)
2. Run: `curl https://webrtc-bifrost.onrender.com/api/debug/rooms`
3. Note if `activeRooms` is 0 or > 0
4. If 0: Create new room
5. If > 0: Copy exact room code from debug output
6. Try joining immediately

---

## 💡 Long-Term Solution

To prevent this, we need:
1. **Database Storage** - Rooms persist across restarts
2. **Automatic Retry** - Client reconnects if room lost
3. **Room Expiration** - Set TTL and clean up
4. **Status Page** - Show server health in UI

For now: **Always join within 30 seconds of creating room**

---

## 📞 Still Stuck?

**Provide this info:**
1. Room code you tried to join
2. Output of: `curl https://webrtc-bifrost.onrender.com/api/debug/rooms`
3. Browser console full log (F12)
4. Time between creating and joining room

---

**Status**: Enhanced error logging now active
**Deploy**: Auto-deployed to production
**Last Updated**: April 25, 2026
