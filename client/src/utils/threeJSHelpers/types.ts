export type IFiber = {
    color: string,
    isMarked?: boolean
    id: string,
    parentId: string,
    tubeId?: string
} 

export type ITube = {
    color: string,
    id: string,
    parentId: string
}

export type ICable = {
    fibers: IFiber[],
    type: "in" | "out",
    id: string,
    tubes?: ITube[]
}