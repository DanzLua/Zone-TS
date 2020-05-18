import { Players, Workspace, HttpService } from "@rbxts/services";

function createBoundPart(object: Zone, boundCFrame: Vector3, boundName: string){
	const part = new Instance("Part");
	part.Anchored = true;
	part.CanCollide = false;
	part.Transparency  = .5;
	part.Size = new Vector3(4,4,4);
	part.Color = Color3.fromRGB(255,0,0);
	part.CFrame = new CFrame(boundCFrame);
	part.Name = boundName;
	object.instances.push(part);
	return part;
}
interface ClusterInterface{
	region: Region3,
	parts: BasePart[],
	volume: number,
	weight?: number|undefined,
}
interface boundPartsInterface{
	BoundMin: Vector3,
	BoundMax: Vector3,
}

export class Zone{
	name: string|undefined=undefined;
	autoUpdate = true;
	respectUpdateQueue = true;
	group: Instance;
	additionalHeight: number;
	regionHeight: number;
	displayBoundParts: boolean;
	groupParts: BasePart[];
	region: Region3|undefined=undefined;
	previousPlayers: Map<Player, boolean> = new Map();
	private playerAddedEvent: BindableEvent;
	private playerRemovingEvent: BindableEvent;
	playerAdded: RBXScriptSignal<(player: Player) => void>;
	playerRemoving: RBXScriptSignal<(player: Player) => void>;
	currentLoop: string|undefined;
	loopInitialized: boolean = false;
	private updatedEvent: BindableEvent;
	updated: RBXScriptSignal<()=>void>;
	instances: BasePart[];
	connections: Map<string, RBXScriptConnection|undefined> = new Map();
	clusters: ClusterInterface[] = [];
	boundMin: Vector3 = new Vector3();
	boundMax: Vector3 = new Vector3();

	constructor(group: Instance, additionalHeight: number|undefined=undefined){
		this.group = group;
		this.additionalHeight = (additionalHeight!==undefined)?additionalHeight:0;
		this.regionHeight = 20;
		this.displayBoundParts = false;
		this.groupParts = [];
		this.playerAddedEvent = new Instance("BindableEvent");
		this.playerRemovingEvent = new Instance("BindableEvent");
		this.playerAdded = this.playerAddedEvent.Event;
		this.playerRemoving = this.playerRemovingEvent.Event;
		this.updatedEvent = new Instance("BindableEvent");
		this.updated = this.updatedEvent.Event;
		this.instances = [];

		this.update();
	}

	//	METHODS
	update(){
		const clusters: ClusterInterface[] = [];
		let totalVolume = 0;
		//const groupParts = this.groupParts;
		const groupParts: BasePart[] = [];
		let updateQueue = 0;
		this.clearConnections();
		for(const[,part] of this.group.GetDescendants().entries()){
			if (part.IsA("BasePart")){
				groupParts.push(part);
				const randomId = HttpService.GenerateGUID();
				const partProperties = ["Size", "Position"];
				const groupEvents = ["ChildAdded", "ChildRemoved"];
				const update = ()=>{
					if (this.autoUpdate){
						coroutine.wrap(()=>{
							if (this.respectUpdateQueue){
								updateQueue+=1;
								wait(0.1);
								updateQueue-=1;
							}
							if (updateQueue === 0){
								this.update();
							}
						})();
					}
				}
				this.connections.set("Size"+randomId, part.GetPropertyChangedSignal("Size").Connect(update));
				this.connections.set("Position"+randomId, part.GetPropertyChangedSignal("Position").Connect(update));
				/*for(const[,prop] of partProperties.entries()){
					if (prop === "Size" || prop === "Position")
						this.connections.set(prop+randomId, part.GetPropertyChangedSignal(prop).Connect(update));
				}*/
				this.connections.set("ChildAdded"+randomId, this.group.ChildAdded.Connect(update));
				this.connections.set("ChildRemoved"+randomId, this.group.ChildAdded.Connect(update));
				/*for(const[,event] of groupEvents.entries()){
					if (event === "ChildAdded")
					this.connections.set(event+randomId, this.group[event])
				}*/
			}
		}

		const scanned: Map<BasePart,boolean> = new Map();
		function getTouchingParts(part: BasePart){
			const connection = part.Touched.Connect(function(){});
			const results = part.GetTouchingParts();
			connection.Disconnect();
			const whitelistResult: BasePart[] = [];
			for(const[,touchingPart] of results.entries()){
				if (groupParts.includes(touchingPart))
					whitelistResult.push(touchingPart);
			}
			return whitelistResult;
		}
		for(const[,part] of groupParts.entries()){
			if (!scanned.get(part)){
				scanned.set(part,true);
				const parts: BasePart[] = [];
				function formCluster(partToScan: BasePart){
					parts.push(partToScan);
					const touchingParts = getTouchingParts(partToScan);
					for(const[,touchingPart] of touchingParts.entries()){
						if (!scanned.get(touchingPart)){
							scanned.set(touchingPart,true);
							formCluster(touchingPart);
						}
					}
				}
				formCluster(part);
				const regionInfo = this.getRegion(parts);
				const region = regionInfo.region;
				const size = region.Size;
				const volume = size.X*size.Y*size.Z;
				totalVolume += volume;
				clusters.push({region: region, parts: parts, volume: volume});
			}
		}
		for(const[part,details] of clusters.entries()){
			details.weight = details.volume/totalVolume;
		}
		this.clusters = clusters;

		const extra = new Vector3(4,4,4);
		const regionInfo = this.getRegion(groupParts);
		const region = regionInfo.region, boundMin = regionInfo.boundMin, boundMax = regionInfo.boundMax;
		this.region = new Region3(boundMin.sub(extra), boundMax.add(extra));
		this.boundMin = boundMin;
		this.boundMax = boundMax;
		this.regionHeight = boundMax.Y - boundMin.Y;
		this.groupParts = groupParts;

		this.updatedEvent.Fire();
	}

	displayBounds(){
		if (!this.displayBoundParts){
			this.displayBoundParts = true;
			const boundParts: boundPartsInterface = {BoundMin: this.boundMin, BoundMax: this.boundMax};
			createBoundPart(this, boundParts.BoundMin, "BoundMin");
			createBoundPart(this, boundParts.BoundMax, "BoundMax");
		}
	}

	castRay(origin: Vector3, parts: BasePart[]){
		const newOrigin = origin.add(new Vector3(0,this.regionHeight,0));
		const lookDirection = newOrigin.add(new Vector3(0,-1,0));
		const ray = new Ray(newOrigin, lookDirection.sub(newOrigin).Unit.mul(this.additionalHeight + this.regionHeight));
		const [hitPart, intersection] = Workspace.FindPartOnRayWithWhitelist(ray, parts);
		if (hitPart){
			const intersectionY = intersection.Y;
			const pointY = origin.Y;
			if (pointY + hitPart.Size.Y > intersectionY)
				return {hitPart: hitPart, intersection: intersection};
		}
		return false;
	}

	getRegion(tableOfParts: BasePart[]){
		const bounds = {
			Min: {Values: [0],
				parseCheck: (v: number, currentValue: number)=>{
					return (v <= currentValue);
				},
				parse: function(valuesToParse: number[]){
					for (const [i, v] of valuesToParse.entries()) {
						const currentValue = (this.Values[i]!==undefined)?this.Values[i]:v;
						if (this.parseCheck(v, currentValue)){
							this.Values[i] = v;
						}
					}
				},
			},
			Max: {Values: [0],
				parseCheck: (v: number, currentValue: number)=>{
					return (v >= currentValue);
				},
				parse: function(valuesToParse: number[]){
					for (const [i, v] of valuesToParse.entries()) {
						const currentValue = (this.Values[i]!==undefined)?this.Values[i]:v;
						if (this.parseCheck(v, currentValue)){
							this.Values[i] = v;
						}
					}
				},
			},
		}
		//bounds.Min.Values = [];
		
		for (const [, part] of tableOfParts.entries()) {
			if (part.IsA("BasePart")){
				this.groupParts.push(part);
				const sizeHalf = part.Size.mul(.5);
				const corners = [
					part.CFrame.mul(new CFrame(-sizeHalf.X, -sizeHalf.Y, -sizeHalf.Z)),
					part.CFrame.mul(new CFrame(-sizeHalf.X, -sizeHalf.Y, sizeHalf.Z)),
					part.CFrame.mul(new CFrame(-sizeHalf.X, sizeHalf.Y, -sizeHalf.Z)),
					part.CFrame.mul(new CFrame(-sizeHalf.X, sizeHalf.Y, sizeHalf.Z)),
					part.CFrame.mul(new CFrame(sizeHalf.X, -sizeHalf.Y, -sizeHalf.Z)),
					part.CFrame.mul(new CFrame(sizeHalf.X, -sizeHalf.Y, sizeHalf.Z)),
					part.CFrame.mul(new CFrame(sizeHalf.X, sizeHalf.Y, -sizeHalf.Z)),
					part.CFrame.mul(new CFrame(sizeHalf.X, sizeHalf.Y, sizeHalf.Z)),
				]
				for (const [, cornerCFrame] of corners.entries()) {
					const [x, y, z] = cornerCFrame.GetComponents();
					const values = [x, y, z];
					bounds.Min.parse(values);
					bounds.Max.parse(values);
				}
			}
		}
		const boundMin = new Vector3(bounds.Min.Values[0],bounds.Min.Values[1],bounds.Min.Values[2]);
		const boundMax = new Vector3(bounds.Max.Values[0],bounds.Max.Values[1],bounds.Max.Values[2]).add(new Vector3(0,this.additionalHeight,0));
		//if (this.displayBoundParts === true){
		//	createBoundPart(this, boundMin, "BoundMin").Parent = this.group;
		//	createBoundPart(this, boundMax, "BoundMax").Parent = this.group;
		//}
		const region = new Region3(boundMin, boundMax);
		return {region, boundMin, boundMax};
	}

	getPlayersInRegion(){
		if (this.region === undefined)return [];
		const playersArray = Players.GetPlayers();
		const playerCharacters = [];
		for (const [, player] of playersArray.entries()) {
			const char = player.Character;
			if (char){
				const hrp = char && char.FindFirstChild("HumanoidRootPart");
				if (hrp)
					playerCharacters.push(hrp);
			}
		}
		const one = playerCharacters[0];
		const partsInRegion = Workspace.FindPartsInRegion3WithWhiteList(this.region, playerCharacters, playersArray.size());
		const charsChecked: Map<Model, boolean> = new Map();
		const playersInRegion = [];
		if (partsInRegion.size() > 0){
			for (const [, part] of partsInRegion.entries()) {
				const char = part.Parent;
				if (char && char.IsA("Model") && !charsChecked.get(char)){
					charsChecked.set(char,true);
					const player = Players.GetPlayerFromCharacter(char);
					if (player)
						playersInRegion.push(player);
				}
			}
		}
		return playersInRegion;
	}

	getPlayer(player: Player){
		const char = player.Character;
		const hrp = char && char.FindFirstChild("HumanoidRootPart");
		if (hrp && hrp.IsA("BasePart")){
			let charOffset = hrp.Size.Y * -1.4;
			const hum = char && char.FindFirstChild("Humanoid");
			if (hum && hum.IsA("Humanoid"))
				charOffset = -hrp.Size.Y/2 - hum.HipHeight + 0.5;
			const origin = hrp.Position.add(new Vector3(0, charOffset, 0));
			const castInfo = this.castRay(origin, this.groupParts);
			if (castInfo && castInfo.hitPart)
				return castInfo.hitPart;
			return false;

			/*const lookDirection = origin.add(new Vector3(0, -1, 0));
			const ray = new Ray(origin, (lookDirection.sub(origin)).Unit.mul(this.regionHeight));
			const groupPart = Workspace.FindPartOnRayWithWhitelist(ray, this.groupParts);
			if (groupPart[0])
				return true;*/
		}
		return false;
	}

	getPlayers(){
		const playersInRegion = this.getPlayersInRegion();
		const playersInZone = [];
		const newPreviousPlayers: Map<Player, boolean> = new Map();
		const oldPreviousPlayers = this.previousPlayers;
		const playersAdded: Player[] = [];
		//	Check for players in zone
		for (const [, player] of playersInRegion.entries()) {
			if (this.getPlayer(player)){
				if (!oldPreviousPlayers.get(player))
					playersAdded.push(player);
				newPreviousPlayers.set(player, true);
				playersInZone.push(player);
			}
		}
		//	Update record of players before firing events otherwise the recursive monster will visit in your sleep
		this.previousPlayers = newPreviousPlayers;
		//	Fire PlayerAdded event if necessary
		for (const [, player] of playersAdded.entries()) {
			this.playerAddedEvent.Fire(player);
		}
		//	Check if any players left zone
		for (const [player, ] of oldPreviousPlayers.entries()) {
			if (!newPreviousPlayers.get(player))
				this.playerRemovingEvent.Fire(player);
		}
		return playersInZone;
	}

	initLoop(loopDelay: number|undefined=undefined){
		if (loopDelay === undefined)loopDelay=0.5;
		const loopId = HttpService.GenerateGUID(false);
		this.currentLoop = loopId;
		if (this.loopInitialized === false){
			this.loopInitialized = true;
			coroutine.wrap(()=>{
				while (this.currentLoop === loopId){
					this.getPlayers();
					wait(loopDelay);
				}
			})()
		}
	}

	endLoop(){
		this.currentLoop = undefined;
	}

	getRandomPoint(){
		let pointCFrame, hitPart, hitIntersection;
		do{
			let parts, region;
			const randomWeight = math.random();
			let totalWeight = 0.01;
			for(const[,details] of this.clusters.entries()){
				if (details.weight!==undefined){
					totalWeight += details.weight;
					if (totalWeight >= randomWeight){
						parts = details.parts;
						region = details.region;
						break;
					}
				}
			}
			if (parts && region){
				const size = region.Size;
				const cframe = region.CFrame;
				const random = new Random();
				const randomCFrame = cframe.mul(new CFrame(random.NextNumber(-size.X/2,size.X/2), random.NextNumber(-size.Y/2,size.Y/2), random.NextNumber(-size.Z/2,size.Z/2)));
				const origin = randomCFrame.Position;
				const castInfo = this.castRay(origin, parts);
				if (castInfo && castInfo.hitPart){
					pointCFrame = randomCFrame;
					hitPart = castInfo.hitPart;
					hitIntersection = castInfo.intersection;
				}
			}
		}while (!pointCFrame);
		return {pointCFrame, hitPart, hitIntersection};
	}

	clearConnections(){
		for(const[cName,connection] of this.connections){
			if (connection)
				connection.Disconnect();
			this.connections.set(cName,undefined);
		}
		this.connections = new Map();
	}

	destroy(){
		this.endLoop();
		this.clearConnections();
		/*for(const[signalName,signal] of this.{

		}*/
		for(const[,instance] of this.instances.entries()){
			if (instance)
				instance.Destroy();
		}
	}
}