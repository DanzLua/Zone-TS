import { Players, Workspace, HttpService } from "@rbxts/services";

function createBoundPart(boundCFrame: Vector3, boundName: string){
	const part = new Instance("Part");
	part.Anchored = true;
	part.CanCollide = false;
	part.Transparency  = .5;
	part.Size = new Vector3(4,4,4);
	part.Color = Color3.fromRGB(255,0,0);
	part.CFrame = new CFrame(boundCFrame);
	part.Name = boundName;
	return part;
}

export class Zone{
	group: Instance;
	regionHeight: number;
	displayBoundParts: boolean;
	groupParts: BasePart[];
	region: Region3;
	previousPlayers: Map<Player, boolean> = new Map();
	private playerAddedEvent: BindableEvent;
	private playerRemovingEvent: BindableEvent;
	playerAdded: RBXScriptSignal<(player: Player) => void>;
	playerRemoving: RBXScriptSignal<(player: Player) => void>;
	currentLoop: string|undefined;
	loopInitialized: boolean = false;

	constructor(group: Instance, regionHeight: number|undefined=undefined, displayBoundParts: boolean|undefined=undefined){
		this.group = group;
		this.regionHeight = regionHeight || 20;
		this.displayBoundParts = displayBoundParts || false;
		this.groupParts = [];
		this.region = this.getRegion();
		//this.previousPlayers = [];
		this.playerAddedEvent = new Instance("BindableEvent");
		this.playerRemovingEvent = new Instance("BindableEvent");
		this.playerAdded = this.playerAddedEvent.Event;
		this.playerRemoving = this.playerRemovingEvent.Event;
	}

	//	METHODS
	getRegion(){
		const bounds = {
			Min: {Values: [0],
				parseCheck: (v: number, currentValue: number)=>{
					return (v <= currentValue);
				},
				parse: function(valuesToParse: number[]){
					for (const [i, v] of valuesToParse.entries()) {
						const currentValue = this.Values[i] || v;
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
						const currentValue = this.Values[i] || v;
						if (this.parseCheck(v, currentValue)){
							this.Values[i] = v;
						}
					}
				},
			},
		}
		bounds.Min.Values = [];
		
		for (const [, part] of this.group.GetChildren().entries()) {
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
		const boundMax = new Vector3(bounds.Max.Values[0],bounds.Max.Values[1],bounds.Max.Values[2]).add(new Vector3(0,this.regionHeight,0));
		if (this.displayBoundParts === true){
			createBoundPart(boundMin, "BoundMin").Parent = this.group;
			createBoundPart(boundMax, "BoundMax").Parent = this.group;
		}
		const region = new Region3(boundMin, boundMax);
		return region;
	}

	getPlayersInRegion(){
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
		const partsInRegion = Workspace.FindPartsInRegion3WithWhiteList(this.region, playerCharacters, playersArray.size());
		const charsChecked: Map<Model, boolean> = new Map();
		const playersInRegion = [];
		if (partsInRegion.size() > 0){
			for (const [, part] of partsInRegion.entries()) {
				const char = part.Parent;
				if (char && char.IsA("Model") && !charsChecked.get(char)){
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
			const origin = hrp.Position.add(new Vector3(0, 4, 0));
			const lookDirection = origin.add(new Vector3(0, -1, 0));
			const ray = new Ray(origin, (lookDirection.sub(origin)).Unit.mul(this.regionHeight));
			const groupPart = Workspace.FindPartOnRayWithWhitelist(ray, this.groupParts);
			if (groupPart[0])
				return true;
		}
		return false;
	}

	getPlayers(){
		const playersInRegion = this.getPlayersInRegion();
		const playersInZone = [];
		const newPreviousPlayers: Map<Player, boolean> = new Map();
		const oldPreviousPlayers = this.previousPlayers;
		const playersAdded = [];
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
					wait(loopDelay);
					this.getPlayers();
				}
			})()
		}
	}

	endLoop(){
		this.currentLoop = undefined;
	}
}