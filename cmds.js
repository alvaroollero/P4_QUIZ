const {models}=require("./model");
const {log,biglog,errorlog,colorize}=require("./out");
const Sequelize =  require('sequelize');


exports.helpCmd=(socket,rl)=>{
  log(socket,"Comandos:");
  log(socket,"h|help - Muestra ayuda");
  log(socket,"list-socket,Listar quizzes existentes");
  log(socket,"show <id>-Muestro la pregunta y la respuesta del quiz indicado");
  log(socket,"add-Añadir nuevo quiz interactivamente");
  log(socket,"delete <id>- Borrar el quiz indicado");
  log(socket,"edit <id>-Editar el quiz indicado");
  log(socket,"test <id>-Probar el quiz indicado");
  log(socket,"p|play-Jugar a preguntar aleatoriamente todos los quizzes");
  log(socket,"credits-Creditos");
  log(socket,"q|quit-Salir del programa");
  rl.prompt();
};

exports.quitCmd=(socket,rl)=>{
  rl.close();
  rl.prompt();
};


const makeQuestion = (rl,text) => {
  return new Sequelize.Promise((resolve,reject)=> {
    rl.question(colorize(text,'red'),answer => {
     resolve(answer.trim());
    });
  });
};

exports.addCmd=(socket,rl)=>{
 makeQuestion(rl,'Introduzca una pregunta: ')
 .then(q => {
   return makeQuestion(rl,'Introduzca la respuesta')
   .then(a => {
     return {question: q, answer: a};
    });
  })
 .then(quiz => {
   return models.quiz.create(quiz);
 })
 .then((quiz) => {
   log(socket,`${colorize('Se ha añadido','magenta')}:  ${quiz.question} ${colorize('=>','magenta')} ${quiz.answer}`);
 })
 .catch(Sequelize.ValidationError,error=> {
   errorlog(socket,'El quiz es erroneo.');
  error.errors.forEach(({message}) => errorlog(message));
 })
 .catch(error => {
   errorlog(socket,error.message);
 })
 .then(() => {
   rl.prompt();
 }); 
};

exports.listCmd=(socket,rl)=>{
  models.quiz.findAll()
  .each(quiz => {
    log(socket,`[${colorize(quiz.id,'magenta')}]:  ${quiz.question}`);
  })
  .catch(error => {
    errorlog(socket,error.message);
  })
  .then(() => {
    rl.prompt();
  })
};

exports.deleteCmd = (socket, rl,id)=> {
    
    validateId(id)
    .then(id => models.quiz.destroy({where: {id}}))
    .catch(error => {
        errorlog(socket, error.message);
    })
    .then(() => {
        rl.prompt();
    });
};

const validateId=id =>{
  return new Sequelize.Promise((resolve,reject) => {
    if (typeof id=== "undefined"){
      reject(new Error(`Falta el parámetro <id>.`));
    }else {
      id=parseInt(id);
      if(Number.isNaN(id)){
        reject(new Error(`El valor del parámetro <id> no es un número.`));
      }else {
        resolve(id);
      }
    }
  });
};




exports.showCmd= (socket,rl,id) =>{
  validateId(id)
  .then(id => models.quiz.findById(id))
  .then(quiz => {
    if(!quiz) {
      throw new Error(`No existe un quiz asociado al id=${id}.`);
    }
    log(socket,`[${colorize(quiz.id,'magenta')}]:  ${quiz.question} ${colorize('=>','magenta')} ${quiz.answer}`);
  })
  .catch(error => {
    errorlog(socket,error.message);
  })
  .then(() => {
    rl.prompt();
  });
};

exports.testCmd = (socket,rl,id) => {
    
  validateId(id)
  .then(id => models.quiz.findById(id))
  .then(quiz => {
    if (!quiz) {
      throw new Error(`No existe un quiz asociado al id=${id}.`);
    }
    log(socket,` [${colorize(quiz.id, 'magenta')}]: ${quiz.question}`);
    return makeQuestion(rl, ' Introduzca la respuesta: ')
    .then(a => {
      if(quiz.answer.toUpperCase() === a.toUpperCase().trim()){
        log(socket,"Su respuesta es correcta");
        biglog(socket,'Correcta', 'green');
      } else{
        log(socket,"Su respuesta es incorrecta");
        biglog(socket,'Incorrecta', 'red');
      }
    });
    
  })
  .catch(error => {
    errorlog(socket,error.message);
  })
  .then(() => {
    rl.prompt();
  });
};

exports.playCmd = (socket,rl) => {
    let score = 0;
    let toBeResolved = [];
  
  const playOne = () => {
    return new Promise((resolve,reject) => {
      
      if(toBeResolved.length <=0){
        log(socket,"No hay nada mas que preguntar.\nFin del examen. Aciertos:");
        resolve();
        return;
      }
      let pos = Math.floor(Math.random()*toBeResolved.length);
      let quiz = toBeResolved[pos];
      toBeResolved.splice(pos,1);
      
      makeQuestion(rl, quiz.question+'? ')
      .then(answer => {
        if(answer.toLowerCase().trim() === quiz.answer.toLowerCase().trim()){
          score++;
          log(socket,`CORRECTO - Lleva "${score} aciertos`);
          resolve(playOne());
        } else {
          log(socket,"INCORRECTO.\nFin del examen. Aciertos:");
          resolve();
        } 
      })
    })
  }
  
  models.quiz.findAll({raw: true})
  .then(quizzes => {
    toBeResolved = quizzes;
  })
  .then(() => {
    return playOne();
  })
  .catch(error => {
    log(socket,error);
  })
  .then(() => {
    biglog(socket,score,'magenta');
    rl.prompt();
  })
};

exports.editCmd= (socket,rl,id) =>{
  validateId(id)
  .then(id => models.quiz.findById(id))
  .then(quiz => {
    if(!quiz){
      throw new Error(`No existe un quiz asociado al id=${id}.`);
    }

    process.stdout.isTTY && setTimeout(() =>{rl.write(quiz.question)},0);
    return makeQuestion(rl,'Introduzca la pregunta: ')
    .then(q => {
      process.stdout.isTTY && setTimeout(() => {rl.write(quiz.answer)},0);
      return makeQuestion(rl, ' Introduzca la respuesta ')
      .then(a => {
        quiz.question = q;
        quiz.answer = a;
        return quiz;
      });
    });
  })
  .then(quiz =>{
    return quiz.save();
  })
  .then(quiz => {
    log(socket,`Se ha cambiado el quiz ${colorize(quiz.id,'magenta')} por: ${quiz.question} ${colorize('=>','magenta')}  ${quiz.answer}`);
  })
  .catch(Sequelize.ValidationError, error => {
    errorlog(socket,'El quiz es erroneo:');
    error.errors.forEach(({message})=> errorlog(message));
  })
  .catch(error => {
    errorlog(socket,error.message);
  })
  .then(() => {
    rl.prompt();
  });
};

exports.creditsCmd=(socket,rl)=>{
  log(socket,"Autor de la practica:","green");
  log(socket,"ALVARO OLLERO","green");
  rl.prompt();
};

