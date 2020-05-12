import { Workspace } from "@rbxts/services";
import { createZone } from "@rbxts/zone-plus";

// Setup zone
const group = Workspace.WaitForChild("CoinSpawner");
const zone = createZone("CoinSpawner", group, 15);
if (!zone)error("Couldn't create zone");

//	Spawn coins within a random position in the zone, and position equal distances above the ground
const distanceAboveGround = 4;
const totalCoins = 40;

const coinTemplate =  new Instance("Part");
coinTemplate.Name = "Coin";
coinTemplate.Anchored = true;
coinTemplate.CanCollide = false;
coinTemplate.Transparency = 0;
coinTemplate.Size = new Vector3(1,4,4);
coinTemplate.Color = Color3.fromRGB(255, 176, 0);
coinTemplate.Reflectance = 0.3;
coinTemplate.Shape = Enum.PartType.Cylinder;
coinTemplate.Parent = undefined;

const spawnCoin = ()=>{
	const randPointInfo = zone.getRandomPoint();
	const randomCFrame = randPointInfo.pointCFrame;
	const hitPart = randPointInfo.hitPart;
	const hitIntersection = randPointInfo.hitIntersection;
	
	if (hitIntersection){
		const coin = coinTemplate.Clone();
		coin.CFrame = new CFrame(hitIntersection.add(new Vector3(0,distanceAboveGround,0)));
		coin.Touched.Connect(function(){
			spawnCoin();
			coin.Destroy();
		})
		coin.Parent = Workspace;
	}
}

for (let i = 0; i < totalCoins; i++) {
	spawnCoin();
}