const functions = require("firebase-functions");
const config = require("../fire_config");
const ordenActivaRef = config.db.collection("ordenActiva").doc("encoladora");
const resumenDiasCollectionRef = config.db.collection("resumen/encoladora/resumenDias");
const resumenHorasCollectionRef = config.db.collection("resumen/encoladora/resumenHoras");
const resumenMinutosCollectionRef = config.db.collection("resumen/encoladora/resumenMinutos");

const moment = require("moment");
const { firestore } = require("firebase-admin");

// const ordenesCollectionRef = config.db.collection("ordenes/encoladora");



// exports.prueba = functions.firestore.document("resumen/encoladora/resumenHoras/{documentId}").onCreate((snaphot, context) => {
//     const oee = snaphot.data().oee
//     console.log(oee);
//     const oeeN = oee + 10;
//     return snaphot.ref.set({ oeeN }, { merge: true });
// });


exports.crearOrdenSegmentada = functions.pubsub.schedule('every 2 minutes').onRun((context) => {
    return null;
});

exports.prueba = functions.firestore.document("ordenes/encoladora").onUpdate((snaphot, context) => {
    try {
        const orden = snaphot.before.data()
        const taza = orden.taza
        const fechaInicio = moment(orden.fechaInicio)
        const fechaFin = moment(orden.fechaFin)
        const now = moment()
        //compara si la fecha de hoy esta entre la fecha de inicio y fin de la orden actual
        const timeCompare = now > fechaInicio && now < fechaFin
        let ordenActiva = config.admin.firestore().doc("/ordenActiva/encoladora");
        if (timeCompare) {
            let ordenSeg = config.db.collection("/ordenesSegmentadas/encoladora/ordenes").doc(moment().format("yyyMMDD"));
            const ordenObj = {
                id: orden.id,
                taza,
                fechaInicio: moment().set(
                    {
                        hour: moment(orden.fechaInicio).hour(),
                        minute: moment(orden.fechaInicio).minute(),
                        second: moment(orden.fechaInicio).second()
                    }
                ).format("yyyy-MM-DD HH:mm:ss"),
                fechaFin: moment().set(
                    {
                        hour: moment(orden.fechaFin).hour(),
                        minute: moment(orden.fechaFin).minute(),
                        second: moment(orden.fechaFin).second()
                    }).format("yyyy-MM-DD HH:mm:ss")
            }
            console.log(ordenObj)
            ordenSeg.set(ordenObj);
            ordenActiva.set({ ...ordenObj, activa: true })
        } else {
            ordenActiva.set({ activa: false })
        }
        const tazaN = taza + 100;
        return snaphot.after.ref.set({ tazaN }, { merge: true });

    } catch (error) {
        console.log(error)
        return null;
    }

});

exports.crearParos = functions.firestore.document("pulsos/{documentId}").onCreate(async (snaphot, context) => {
    try {
        const pulso = snaphot.data()
        const ordenActiva = await ordenActivaRef.get()
        console.log(ordenActiva.data())
        // const paroObj={
        //     fechaInicio:
        // }

    } catch (error) {
        console.log(error)
        return null;
    }
})

exports.CrearResumenMinutos = functions.firestore.document("pulsos/{documentId}").onCreate(async (snaphot, context) => {
    try {
        const pulso = snaphot.data()
        const idResumenMinuto = moment(pulso.hora).format("yyyyMMDDHHmm")
        let resumenActual = await config.admin.firestore().doc(`/resumen/encoladora/resumenMinutos/${idResumenMinuto}`).get();
        if (resumenActual.data()) {

            resumenActual.ref.update({
                pulsos: resumenActual.data().pulsos + 1
            })
        } else {
            console.log("nuevo")
            let resumen = resumenMinutosCollectionRef.doc(idResumenMinuto)
            resumen.set({
                hora: pulso.hora,
                pulsos: 1
            })
        }
        return null;
    } catch (error) {
        console.log(error)
        return null;
    }

});
exports.CrearResumenHoras = functions.firestore.document("resumen/encoladora/resumenMinutos/{documentId}").onCreate(async (snaphot, context) => {
    try {
        const resumenMinuto = snaphot.data()
        const idResumenHora = moment(resumenMinuto.hora).format("yyyyMMDDHH")
        let resumenActual = await config.admin.firestore().doc(`/resumen/encoladora/resumenHoras/${idResumenHora}`).get();
        const minutoAnteriorSnap = await resumenMinutosCollectionRef.where("hora", "<", resumenMinuto.hora).orderBy("hora", "desc").limit(1).get()
        const minutoAnteriorData = minutoAnteriorSnap.docs[0].data()
        if (resumenActual.data()) {
            console.log("existe hora")
            console.log(resumenMinuto.hora)

            console.log(minutoAnteriorData)
            resumenActual.ref.update({
                pulsos: resumenActual.data().pulsos + minutoAnteriorData.pulsos
            })
        } else {
            console.log("nuevo hora")
            console.log(minutoAnteriorData)
            if (minutoAnteriorData.pulsos > 1) {
                const idResumenAnterior = moment(resumenMinuto.hora).set({ hour: moment(resumenMinuto.hora).hour() - 1 }).format("yyyyMMDDHH")
                let resumenAnterior = await config.admin.firestore().doc(`/resumen/encoladora/resumenHoras/${idResumenAnterior}`).get();
                resumenAnterior.ref.update({
                    pulsos: resumenAnterior.data().pulsos + minutoAnteriorData.pulsos - 1
                })

            }
            let resumen = resumenHorasCollectionRef.doc(idResumenHora)
            resumen.set({
                fechaInicio: moment(resumenMinuto.hora).set({ minute: 0, second: 0 }).format("yyyy-MM-DD HH:mm:ss"),
                fechaFin: moment(resumenMinuto.hora).set({ hour: moment(resumenMinuto.hora).hour() + 1, minute: 0, second: 0 }).format("yyyy-MM-DD HH:mm:ss"),
                pulsos: 1
            })
        }
        return null;
    } catch (error) {
        console.log(error)
        return null;
    }

});

exports.CrearResumenDias = functions.firestore.document("resumen/encoladora/resumenHoras/{documentId}").onCreate(async (snaphot, context) => {
    try {
        const resumenHora = snaphot.data()
        const idResumenDia = moment(resumenHora.fechaInicio).format("yyyyMMDD")
        let resumenActual = await config.admin.firestore().doc(`/resumen/encoladora/resumenDias/${idResumenDia}`).get();
        const horaAnteriorSnap = await resumenHorasCollectionRef.where("fechaInicio", "<", resumenHora.fechaInicio).orderBy("fechaInicio", "desc").limit(1).get()
        const horaAnteriorData = horaAnteriorSnap.docs[0].data()
        if (resumenActual.data()) {
            console.log("existe dia")
            resumenActual.ref.update({
                pulsos: resumenActual.data().pulsos + horaAnteriorData.pulsos
            })
        } else {
            console.log("nuevo dia")
            if (horaAnteriorData.pulsos > 1) {
                const idResumenAnterior = moment(resumenHora.fechaInicio).set({ hour: moment(resumenHora.fechaInicio).date() - 1 }).format("yyyyMMDD")
                let resumenAnterior = await config.admin.firestore().doc(`/resumen/encoladora/resumeDias/${idResumenAnterior}`).get();
                resumenAnterior.ref.update({
                    pulsos: resumenAnterior.data().pulsos + horaAnteriorData.pulsos - 1
                })

            }
            let resumen = resumenDiasCollectionRef.doc(idResumenDia)
            resumen.set({
                fechaInicio: moment(resumenHora.fechaInicio).set({ hour: 0, minute: 0, second: 0 }).format("yyyy-MM-DD HH:mm:ss"),
                fechaFin: moment(resumenHora.fechaInicio).set({ hour: 23, minute: 59, second: 59 }).format("yyyy-MM-DD HH:mm:ss"),
                pulsos: 1
            })
        }
        return null;
    } catch (error) {
        console.log(error)
        return null;
    }

});

