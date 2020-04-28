# Zone+TS
A port of ForeverHD's Zone+ module.

## Installation:
```
npm i @rbxts/zone-plus
```

## Example Usage
```TS
import { Workspace } from "@rbxts/services";
import { Zone } from "@rbxts/zone-plus";

const newZone = new Zone(Workspace.WaitForChild("SafeZone"));

function beginVoting(){
	let votes = 0
	
	let connectionAdded = newZone.playerAdded.Connect(function(player){
		votes = votes + 1
	})
	let connectionRemoving = newZone.playerRemoving.Connect(function(player){
		votes = votes - 1
	})
	newZone.initLoop()
	
	wait(10)
	
	connectionAdded.Disconnect()
	connectionRemoving.Disconnect()
	newZone.endLoop()
	
	return votes
}
print(beginVoting());
```

### Original Documentation
in Lua found at: https://devforum.roblox.com/t/zone-retrieving-players-within-an-area-zone/397465
