import { Workspace, Players } from "@rbxts/services";
import { createZone } from "@rbxts/zone-plus";

//	Setup zone
const group = Workspace.WaitForChild("SafeZone1");
const zone = createZone("SafeZone1", group, 15);
if (!zone)error("Couldn't create zone");


//	Generate 2000 random parts within zone - not necessary, it just looks cool :)
for (let i = 1; i < 2000; i++) {
	const randPointInfo = zone.getRandomPoint();
	const randomCFrame = randPointInfo.pointCFrame;
	const hitPart = randPointInfo.hitPart;
	const hitIntersection = randPointInfo.hitIntersection;

	const part = new Instance("Part");
	part.Anchored = true;
	part.CanCollide = false;
	part.Transparency = 0.5;
	part.Size = new Vector3(1,1,1);
	part.Color = Color3.fromRGB(0, 255, 255);
	part.CFrame = randomCFrame;
	part.Parent = Workspace;
}


//	Create a safe zone by checking for players within the zone every X seconds
const safeZoneCheckInterval = 0.2;
const forceFieldName = "PineappleDoesNotGoOnPizza";
const forceFieldTemplate = new Instance("ForceField");
forceFieldTemplate.Name = forceFieldName;

while (true){
	wait(safeZoneCheckInterval);

	//	Get players in zone
	const playersInZone = zone.getPlayers();
	const playersInZoneDictionary: Map<Player,boolean> = new Map();
	for(const[,plr] of playersInZone.entries()){
		playersInZoneDictionary.set(plr,true);
	}

	//	Add/remove forcefield accordingly
	for(const[,plr] of Players.GetPlayers().entries()){
		const char = plr.Character;
		let forceField = char && char.FindFirstChild(forceFieldName);
		if (playersInZoneDictionary.get(plr)){
			if (!forceField){
				forceField = forceFieldTemplate.Clone();
				forceField.Parent = char;
			}
		}else if (forceField){
			forceField.Destroy();
		}
	}
}