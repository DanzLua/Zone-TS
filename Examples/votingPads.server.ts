import { Workspace } from "@rbxts/services";
import { createZone, removeZone } from "@rbxts/zone-plus";
import { Zone } from "@rbxts/zone-plus/zone";

type FrameType = Frame &{
	TextLabel: TextLabel;
};
type VoteMachineType = BasePart &{
	SurfaceGui: SurfaceGui &{
		Container: Frame &{
			Votes: Folder &{
				Blue: FrameType;
				Green: FrameType;
				Red: FrameType;
			};
			Status: TextLabel;
			Title: TextLabel;
		}
	}
}

//	Config
const voteTime = 10;


//	Vote
const votePads = Workspace.WaitForChild("VotingPads");
const voteMachine = Workspace.WaitForChild("VoteMachine9000") as VoteMachineType;
const container = voteMachine.SurfaceGui.Container;
const votes = container.Votes;
const status = container.Status;

const voteInfo: Map<Zone,number> = new Map();

function beginVote(){
	//	Setup voting zones
	const zones: Zone[] = []
	for(const[,group] of votePads.GetChildren().entries()){
		const zoneName = group.Name;
		const frame = votes.FindFirstChild(zoneName) as FrameType;
		if (frame){
			const zone = createZone(zoneName, group, 15);
			if (zone){
				const updateVote = (increment: number)=>{
					const existing = voteInfo.get(zone);
					voteInfo.set(zone, (existing!==undefined)?(existing+increment):0)
					const n = voteInfo.get(zone);
					if (n !== undefined)
						frame.TextLabel.Text = tostring(n);
				}
				voteInfo.set(zone,0);
				zone.playerAdded.Connect(function(player){
					updateVote(1);
				})
				zone.playerRemoving.Connect(function(player){
					updateVote(-1);
				})
				zone.initLoop(0.1);
				updateVote(0);
				frame.Visible = true;
				zones.push(zone);
			}
		}
	}

	//	Countdown
	for (let i = 1; i < voteTime; i++) {
		status.Text = ("Vote! (%s)").format(voteTime+1-i);
		wait(1);
	}

	//	Determine winner
	const winners: Zone[] = [];
	let winningScore = 0;
	for(const[,zone] of zones.entries()){
		const score = voteInfo.get(zone);
		if (score !== undefined && score > winningScore){
			winningScore = score;
		}
	}
	for(const[,zone] of zones.entries()){
		const score = voteInfo.get(zone);
		if (score !== undefined && zone.name){
			const frame = votes.FindFirstChild(zone.name) as FrameType;
			if (score === winningScore){
				frame.Visible = true;
				winners.push(zone);
			}else{
				frame.Visible = false;
			}
			removeZone(zone.name);
		}
	}

	//	Display results
	if (winningScore === 0){
		status.Text = "No votes were made.";
	}else if(winners.size() > 1){
		status.Text = "It's a tie!";
	}else if(winners[0] && winners[0].name){
		status.Text = ("The winner is %s!").format(winners[0].name);
	}
	wait(3);

	//	Hide frames and restart
	status.Text = "Beginning new round...";
	for(const[,f] of votes.GetChildren().entries()){
		const frame = f as FrameType;
		frame.Visible = false;
	}
	wait(1);
}

while (true){
	beginVote();
	wait(1);
}