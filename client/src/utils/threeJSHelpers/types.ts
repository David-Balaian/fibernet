export type IFiber = {
    color: string,
} 

export type ICable = {
    fibers: IFiber[],
    type: "in" | "out"
}