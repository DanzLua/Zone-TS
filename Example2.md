## Example2 Usage
```TS
import { Workspace } from "@rbxts/services";
import { Zone } from "@rbxts/zone-plus";

const safeZoneCheckInterval = 0.5;
const forceFieldName = "SafeZoneFF";

let forceFieldTemplate = new Instance("ForceField")
forceFieldTemplate.Name = forceFieldName

const newZone = new Zone(Workspace.WaitForChild("SafeZone"))

while (true){
	wait(safeZoneCheckInterval)
	
	const playersInZone = newZone.getPlayers()
	const playersInZoneDictionary: Map<Player, boolean> = new Map();
	for (const [, plr] of playersInZone.entries()){
		playersInZoneDictionary.set(plr, true);
	}
	
	for (const [, plr] of Players.GetPlayers().entries()){
		const char = plr.Character
		if (char){
			let forceField = char.FindFirstChild(forceFieldName)
			if (playersInZoneDictionary.get(plr) === true){
				if (!forceField){
					forceField = forceFieldTemplate.Clone()
					forceField.Parent = char
				}
			}else if(forceField){
				forceField.Destroy()
			}
		}
	}
	
}
```