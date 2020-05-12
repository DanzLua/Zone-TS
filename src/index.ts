import { Zone } from "./zone";

const errorStart = "Zone+ | ";
const zones: Map<string,Zone> = new Map();

export function createZone(name: string, group: Instance, additionalHeight: number){
	const z = zones.get(name);
	if (z){
		warn(("%sFailed to create zone '%s': a zone already exists under that name.").format(errorStart, name));
		return;
	}
	if (!group){
		warn(("%sFailed to create zone '%s': a group of parts must be specified as the second argument to setup a zone.").format(errorStart, name));
		return;
	}
	const zone = new Zone(group, additionalHeight);
	zone.name = name;
	zones.set(name,zone);
	return zone;
}

export function getZone(name: string){
	const zone = zones.get(name);
	if (!zone){
		warn(("%sFailed to get Zone '%s': zone not found.").format(errorStart, name));
		return;
	}
	return zone;
}

export function getAllZones(){
	const allZones: Zone[] = [];
	for(const[name,zone] of zones){
		allZones.push(zone);
	}
	return allZones;
}

export function removeZone(name: string){
	const zone = zones.get(name);
	if (!zone){
		warn(("%sFailed to remove Zone '%s': zone not found.").format(errorStart, name));
		return;
	}
	zone.destroy();
	zones.delete(name);
	return true;
}