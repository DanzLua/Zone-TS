import { Workspace } from "@rbxts/services";
import { createZone } from "@rbxts/zone-plus";

//	Setup zone
const group = Workspace.WaitForChild("SafeZone2");
const zone = createZone("SafeZone2", group, 15);
if (!zone)error("Couldn't create zone");


//	Create a safe zone by listening for players entering and leaving the zone
const safeZoneCheckInterval = 0.2;
const forceFieldName = "PineapplesForLife";
const forceFieldTemplate = new Instance("ForceField");
forceFieldTemplate.Name = forceFieldName;

const connectionAdded = zone.playerAdded.Connect(function(player){
	const char = player.Character;
	let forceField = char && char.FindFirstChild(forceFieldName);
	if (!forceField){
		forceField = forceFieldTemplate.Clone();
		forceField.Parent = char;
	}
})
const connectionRemoving = zone.playerRemoving.Connect(function(player){
	const char = player.Character;
	const forceField = char && char.FindFirstChild(forceFieldName);
	if (forceField)
		forceField.Destroy();
})
zone.initLoop(safeZoneCheckInterval);