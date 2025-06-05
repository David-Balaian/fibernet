export type IFiber = {
    color: string,
    isMarked?: boolean
    id: string,
    cableId: string,
    tubeId?: string
} 

export type ITube = {
    color: string,
    id: string,
    cableId: string
}

export type ICable = {
    fibers: IFiber[],
    type: "in" | "out",
    id: string,
    tubes?: ITube[]
}