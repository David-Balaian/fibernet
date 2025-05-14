export type IFiber = {
    color: string,
    isMarked?: boolean
} 

export type ICable = {
    fibers: IFiber[],
    type: "in" | "out"
}